import type {
  PoseLandmark,
  PoseLandmarkName,
  PostureSample as CameraSample,
} from "@/shared/pose-camera/pose-camera.types";

import type { PostureDrive, PostureSample } from "./bodyfit-posture";
import type { DriveContext } from "./bodyfit.types";

// 주행 중 카메라 관찰(C-7) → 주행 자세 기록(PostureDrive, D-6 화면이 읽는 형식).
// 카메라는 몇 초마다 상반신 관절의 화면 좌표만 준다. 출발할 때 모습과 비교한 변화를 분마다 cm·도로 바꾼다.
// 화면 픽셀을 cm 로 바꿀 기준이 없어 어깨 폭을 키로 추정해 쓴다. 그래서 값은 "대략"이다.

/** 관절이 화면 안에 보일 가능성이 이보다 낮으면 쓰지 않는다. */
const MIN_LIKELIHOOD = 0.5;
/** 어깨 폭이 화면 폭의 이 비율보다 작으면 사람이 너무 멀거나 잘못 잡힌 것으로 본다. */
const MIN_SHOULDER_WIDTH = 0.05;
/** 어깨 폭 ≈ 키 × 0.259 (Drillis & Contini 1966 인체 비율표, bodyfit-body-scan.ts 와 같은 자료). */
const SHOULDER_WIDTH_RATIO = 0.259;
/** 출발 직전 이 시간 안의 표본도 출발 자세로 쓴다 (주차 중 운전석에 앉아 있던 모습). */
const PRE_START_MS = 60 * 1000;
/** 출발 후 이 시간까지의 모습을 출발 자세로 본다. 짧은 주행은 주행 시간의 10% 까지만. */
const BASELINE_MS = 2 * 60 * 1000;
const MIN_BASELINE_SAMPLES = 2;
/** 이보다 표본이 적으면 기록하지 않는다 (카메라가 가려졌거나 사람이 안 보였다). */
const MIN_SAMPLES = 6;
const MINUTE_MS = 60 * 1000;
/** 어깨~골반 길이가 출발 때의 이 비율보다 길면 숙이지 않은 것으로 본다 (약 11° 미만). */
const TORSO_NOISE = 0.98;

type Point = { x: number; y: number };

/** 한 장에서 뽑은 화면 위 위치 (픽셀). */
export type PoseFrame = {
  shoulderWidth: number;
  /** 어깨 가운데에서 머리(귀 가운데, 없으면 코)까지의 높이. 머리가 앞으로 숙거나 나오면 줄어든다 */
  neck: number;
  /** 어깨 가운데의 화면 높이 위치. 몸이 시트에서 미끄러져 내려가면 커진다 */
  shoulderY: number;
  /** 어깨 가운데에서 골반 가운데까지의 길이. 골반이 보일 때만 있다. 앞으로 숙이면 짧아 보인다 */
  torso: number | null;
};

const mid = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function poseFrame(sample: {
  width: number;
  height: number;
  landmarks: readonly PoseLandmark[];
}): PoseFrame | null {
  const seen = new Map<PoseLandmarkName, PoseLandmark>();
  for (const landmark of sample.landmarks) {
    if (landmark.likelihood >= MIN_LIKELIHOOD)
      seen.set(landmark.name, landmark);
  }
  const leftShoulder = seen.get("leftShoulder");
  const rightShoulder = seen.get("rightShoulder");
  if (!leftShoulder || !rightShoulder || sample.width <= 0) return null;
  const shoulderWidth = distance(leftShoulder, rightShoulder);
  if (shoulderWidth < sample.width * MIN_SHOULDER_WIDTH) return null;

  const leftEar = seen.get("leftEar");
  const rightEar = seen.get("rightEar");
  const head = leftEar && rightEar ? mid(leftEar, rightEar) : seen.get("nose");
  if (!head) return null;

  const shoulders = mid(leftShoulder, rightShoulder);
  const leftHip = seen.get("leftHip");
  const rightHip = seen.get("rightHip");
  return {
    shoulderWidth,
    neck: shoulders.y - head.y,
    shoulderY: shoulders.y,
    torso:
      leftHip && rightHip ? distance(shoulders, mid(leftHip, rightHip)) : null,
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianFrame(frames: readonly PoseFrame[]): PoseFrame {
  const torsos = frames.flatMap((frame) =>
    frame.torso === null ? [] : [frame.torso],
  );
  return {
    shoulderWidth: median(frames.map((frame) => frame.shoulderWidth)),
    neck: median(frames.map((frame) => frame.neck)),
    shoulderY: median(frames.map((frame) => frame.shoulderY)),
    // 절반 넘게 골반이 보였을 때만 등 각도를 낸다
    torso: torsos.length * 2 > frames.length ? median(torsos) : null,
  };
}

const clamp = (value: number, limit: number) =>
  Math.min(limit, Math.max(-limit, value));
// 소수 첫째 자리까지. -0 이 섞이지 않게 0 을 더한다.
const round1 = (value: number) => Math.round(value * 10) / 10 + 0;

/** 출발 자세와 비교한 한 분의 변화 (cm·도). 범위는 postureSampleSchema 와 같다. */
function changeAgainst(
  base: PoseFrame,
  now: PoseFrame,
  pxPerCm: number,
): Omit<PostureSample, "minute"> {
  // 정면 카메라에서 앞으로 숙이면 어깨~골반이 짧아 보인다: 짧아진 비율의 역코사인이 숙인 각도다.
  // 역코사인은 1 근처에서 아주 민감해(2% 흔들림 → 11°) 흔들림 범위 안의 변화는 0 으로 본다.
  const torsoRatio =
    base.torso !== null && now.torso !== null && base.torso > 0
      ? Math.min(1, now.torso / base.torso)
      : 1;
  const backLeanDeg =
    torsoRatio > TORSO_NOISE ? 0 : (Math.acos(torsoRatio) * 180) / Math.PI;
  return {
    // 머리가 어깨 쪽으로 내려온 만큼을 앞으로 나온 거리로 본다 (정면 카메라로는 앞뒤를 직접 잴 수 없다).
    headForwardCm: round1(clamp((base.neck - now.neck) / pxPerCm, 40)),
    shoulderDropCm: round1(
      clamp((now.shoulderY - base.shoulderY) / pxPerCm, 40),
    ),
    backLeanDeg: round1(clamp(backLeanDeg, 60)),
  };
}

/**
 * 한 번의 주행에서 모은 카메라 표본 → 주행 자세 기록. 표본이 모자라면 null (기록하지 않는다).
 * 출발 직전~출발 후 잠깐의 모습을 출발 자세로 삼고, 그 뒤는 분마다 가운데 값을 출발 자세와 비교한다.
 */
export function toPostureDrive({
  profileId,
  context,
  startedAt,
  endedAt,
  heightCm,
  samples,
  sample = false,
}: {
  profileId: string;
  context: DriveContext;
  startedAt: number;
  endedAt: number;
  /** 운전자의 키. 어깨 폭(cm)을 추정해 화면 픽셀을 cm 로 바꾼다 */
  heightCm: number;
  samples: readonly CameraSample[];
  /** 시연용 모의 표본으로 만든 기록 */
  sample?: boolean;
}): PostureDrive | null {
  const driveMs = endedAt - startedAt;
  if (driveMs <= 0 || heightCm <= 0) return null;
  const baselineEnd = startedAt + Math.min(BASELINE_MS, driveMs * 0.1);

  const baseline: PoseFrame[] = [];
  const byMinute = new Map<number, PoseFrame[]>();
  let used = 0;
  for (const item of samples) {
    if (item.at < startedAt - PRE_START_MS || item.at > endedAt) continue;
    const frame = poseFrame(item);
    if (!frame) continue;
    used += 1;
    if (item.at <= baselineEnd) baseline.push(frame);
    const minute = Math.max(0, Math.floor((item.at - startedAt) / MINUTE_MS));
    byMinute.set(minute, [...(byMinute.get(minute) ?? []), frame]);
  }
  if (used < MIN_SAMPLES || baseline.length < MIN_BASELINE_SAMPLES) return null;

  const base = medianFrame(baseline);
  const pxPerCm = base.shoulderWidth / (heightCm * SHOULDER_WIDTH_RATIO);
  const durationMin = Math.max(1, Math.round(driveMs / MINUTE_MS));
  const postureSamples = [...byMinute.entries()]
    .filter(([minute]) => minute <= durationMin)
    .sort(([a], [b]) => a - b)
    .map(([minute, frames]) => ({
      minute,
      ...changeAgainst(base, medianFrame(frames), pxPerCm),
    }));

  return {
    profileId,
    startedAt,
    context,
    durationMin,
    samples: postureSamples,
    sample,
  };
}

// 시연용 모의 표본 (에뮬레이터 카메라는 고정 사진이라 자세가 변하지 않는다).
// 1분 시연 주행으로는 "5분 넘게 이어진 쏠림"을 보여 줄 수 없어, 도착 시각까지 이어진 한 시간짜리 주행으로 만든다.
// 주행의 55% 지점부터 머리가 앞으로 나오고 몸이 미끄러지는 모습이다. 실제 관찰값이 아니다.
const DEMO_DRIVE_MS = 60 * MINUTE_MS;
const DEMO_SAMPLE_GAP_MS = 15 * 1000;
const DEMO_DRIFT_FROM = 0.55;

export function demoCameraSamples(endedAt: number): {
  startedAt: number;
  samples: CameraSample[];
} {
  const startedAt = endedAt - DEMO_DRIVE_MS;
  const count = Math.floor(DEMO_DRIVE_MS / DEMO_SAMPLE_GAP_MS) + 1;
  const samples: CameraSample[] = [];
  for (let i = 0; i < count; i += 1) {
    const progress = i / (count - 1);
    // 25% 구간에 걸쳐 서서히 무너진다.
    const drift = Math.min(1, Math.max(0, (progress - DEMO_DRIFT_FROM) / 0.1));
    // 사람은 가만히 있어도 조금씩 흔들린다.
    const wobble = i % 2 === 0 ? 0 : 1;
    const shoulderY = 300 + 18 * drift;
    const earY = 180 + 40 * drift + wobble;
    // 골반도 함께 미끄러지고, 상체는 조금 앞으로 숙인다 (어깨~골반이 3% 짧아 보임 → 약 14°).
    const hipY = 470 + 13 * drift;
    const point = (name: PoseLandmarkName, x: number, y: number) => ({
      name,
      x,
      y,
      likelihood: 0.99,
    });
    samples.push({
      at: Math.round(startedAt + DEMO_DRIVE_MS * progress),
      width: 640,
      height: 480,
      landmarks: [
        point("nose", 320, earY + 10),
        point("leftEar", 280, earY),
        point("rightEar", 360, earY),
        point("leftShoulder", 220, shoulderY),
        point("rightShoulder", 420, shoulderY),
        point("leftHip", 250, hipY),
        point("rightHip", 390, hipY),
      ],
    });
  }
  return { startedAt, samples };
}
