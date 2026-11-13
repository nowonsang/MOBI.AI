import type {
  PoseCapture,
  PoseLandmark,
  PoseLandmarkName,
  PostureSample,
} from "@/shared/pose-camera/pose-camera.types";

import type { PostureReport, PostureSign, SeatNudge } from "./bodyfit.types";

// C-7 주행 중 자세 관찰. 카메라가 몇 초마다 준 상반신 관절로 "출발할 때 자세"와 비교해 언제부터 무너졌는지 찾는다.
// 카메라 위치·거리는 차마다 달라 cm 를 재지 않는다. 같은 사람의 출발 때 모습과 비교한 변화만 본다.

/** 관절이 화면 안에 보일 가능성이 이보다 낮으면 쓰지 않는다. */
const MIN_LIKELIHOOD = 0.5;
/** 어깨 폭이 화면 폭의 이 비율보다 작으면 사람이 너무 멀거나 잘못 잡힌 것으로 본다. */
const MIN_SHOULDER_WIDTH = 0.05;

/**
 * 한 장에서 뽑은 자세 지표. 모두 어깨 폭이나 화면 높이에 대한 비율이라 카메라 거리와 해상도에 덜 흔들린다.
 * - neck: 어깨 가운데에서 머리(귀 가운데, 없으면 코)까지의 높이 ÷ 어깨 폭. 머리가 앞으로 숙거나 나오면 줄어든다.
 * - headScale: 두 귀 사이 ÷ 어깨 폭. 머리가 카메라 쪽(앞)으로 나오면 커진다. 귀가 둘 다 보일 때만 있다.
 * - shoulderLevel: 어깨 가운데의 화면 높이 위치(0 = 위, 1 = 아래). 몸이 시트에서 미끄러져 내려가면 커진다.
 */
export type PostureFeatures = {
  neck: number;
  headScale: number | null;
  shoulderLevel: number;
};

type Point = { x: number; y: number };

const mid = (a: Point, b: Point): Point => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function postureFeatures(capture: PoseCapture): PostureFeatures | null {
  const seen = new Map<PoseLandmarkName, PoseLandmark>();
  for (const landmark of capture.landmarks) {
    if (landmark.likelihood >= MIN_LIKELIHOOD)
      seen.set(landmark.name, landmark);
  }
  const leftShoulder = seen.get("leftShoulder");
  const rightShoulder = seen.get("rightShoulder");
  if (
    !leftShoulder ||
    !rightShoulder ||
    capture.width <= 0 ||
    capture.height <= 0
  )
    return null;
  const shoulderWidth = distance(leftShoulder, rightShoulder);
  if (shoulderWidth < capture.width * MIN_SHOULDER_WIDTH) return null;

  const leftEar = seen.get("leftEar");
  const rightEar = seen.get("rightEar");
  const nose = seen.get("nose");
  const head = leftEar && rightEar ? mid(leftEar, rightEar) : nose;
  if (!head) return null;

  const shoulders = mid(leftShoulder, rightShoulder);
  return {
    neck: (shoulders.y - head.y) / shoulderWidth,
    headScale:
      leftEar && rightEar ? distance(leftEar, rightEar) / shoulderWidth : null,
    shoulderLevel: shoulders.y / capture.height,
  };
}

// 이 정도 변하면 "무너졌다"고 본다. 초깃값이며 실제 사람으로 시험해 맞춘다.
const HEAD_FORWARD_NECK_DROP = 0.15; // 목 높이가 출발 때보다 15% 이상 줄어듦
const HEAD_FORWARD_SCALE_RISE = 0.1; // 머리 크기가 10% 이상 커짐
const SLUMP_SHOULDER_DROP = 0.04; // 어깨가 화면 높이의 4% 이상 내려감

/** 주행을 이만큼의 구간으로 나눠 본다. 1분짜리 시연 주행과 두 시간 주행을 같은 방법으로 본다. */
const SLICES = 10;
/** 출발 직전 이 시간 안의 표본도 출발 자세로 쓴다 (주차 중 운전석에 앉아 있던 모습). */
const PRE_START_MS = 60 * 1000;
/** 이보다 표본이 적으면 판단하지 않는다 (카메라가 가려졌거나 사람이 안 보였다). */
const MIN_SAMPLES = 6;
const MIN_BASELINE_SAMPLES = 2;
/** 무너진 상태가 이 구간 수 이상 이어져야 한다 (잠깐 몸을 숙인 것은 무시한다). */
const MIN_DRIFT_SLICES = 2;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianFeatures(list: readonly PostureFeatures[]): PostureFeatures {
  const scales = list.flatMap((item) =>
    item.headScale === null ? [] : [item.headScale],
  );
  return {
    neck: median(list.map((item) => item.neck)),
    headScale: scales.length > 0 ? median(scales) : null,
    shoulderLevel: median(list.map((item) => item.shoulderLevel)),
  };
}

function signsAgainst(
  base: PostureFeatures,
  now: PostureFeatures,
): PostureSign[] {
  const signs: PostureSign[] = [];
  const neckDrop = base.neck > 0 ? (base.neck - now.neck) / base.neck : 0;
  const scaleRise =
    base.headScale !== null && now.headScale !== null && base.headScale > 0
      ? (now.headScale - base.headScale) / base.headScale
      : 0;
  if (
    neckDrop >= HEAD_FORWARD_NECK_DROP ||
    scaleRise >= HEAD_FORWARD_SCALE_RISE
  )
    signs.push("headForward");
  if (now.shoulderLevel - base.shoulderLevel >= SLUMP_SHOULDER_DROP)
    signs.push("slumped");
  return signs;
}

/**
 * 한 번의 주행을 분석한다. 표본이 모자라면 null (판단하지 않는다).
 * 주행을 SLICES 개 구간으로 나눠, 첫 구간(+ 출발 직전)을 출발 자세로 삼고 각 구간의 가운데 값과 비교한다.
 * 어떤 구간부터 끝까지 계속 무너져 있으면 그 구간의 시작을 "무너지기 시작한 때"로 본다.
 */
export function analyzePosture({
  profileId,
  samples,
  startedAt,
  endedAt,
  demo = false,
}: {
  profileId: string;
  samples: readonly PostureSample[];
  startedAt: number;
  endedAt: number;
  /** 시연용 모의 표본으로 만든 결과인지. 화면에 함께 알린다 */
  demo?: boolean;
}): PostureReport | null {
  const driveMs = endedAt - startedAt;
  if (driveMs <= 0) return null;
  const sliceMs = driveMs / SLICES;

  const slices: PostureFeatures[][] = Array.from({ length: SLICES }, () => []);
  let used = 0;
  for (const sample of samples) {
    if (sample.at < startedAt - PRE_START_MS || sample.at > endedAt) continue;
    const features = postureFeatures(sample);
    if (!features) continue;
    const index = Math.min(
      SLICES - 1,
      Math.max(0, Math.floor((sample.at - startedAt) / sliceMs)),
    );
    slices[index].push(features);
    used += 1;
  }
  if (used < MIN_SAMPLES || slices[0].length < MIN_BASELINE_SAMPLES)
    return null;

  const base = medianFeatures(slices[0]);
  // 표본이 없는 구간은 판단하지 않고 건너뛴다 (null).
  const signsBySlice = slices.map((list, index) =>
    index === 0 || list.length === 0
      ? null
      : signsAgainst(base, medianFeatures(list)),
  );

  const known = signsBySlice
    .map((signs, index) => ({ signs, index }))
    .filter(
      (item): item is { signs: PostureSign[]; index: number } =>
        item.signs !== null,
    );
  // 뒤에서부터 "계속 무너져 있는" 구간을 늘려 간다.
  let driftFrom = known.length;
  while (driftFrom > 0 && known[driftFrom - 1].signs.length > 0) driftFrom -= 1;
  const drifted = known.slice(driftFrom);

  const common = {
    profileId,
    endedAt,
    driveMs,
    sampleCount: used,
    demo,
  };
  if (drifted.length < MIN_DRIFT_SLICES) {
    return { ...common, driftAfterMs: null, signs: [], nudges: [] };
  }

  // 무너진 구간의 절반 이상에서 보인 모습만 남긴다.
  const signs = (["headForward", "slumped"] as const).filter(
    (sign) =>
      drifted.filter((item) => item.signs.includes(sign)).length * 2 >=
      drifted.length,
  );
  return {
    ...common,
    driftAfterMs: Math.round(drifted[0].index * sliceMs),
    signs,
    nudges: nudgesForSigns(signs),
  };
}

/**
 * 무너진 모습 → 다음 자세 조절안. 카메라로 본 것은 운전자가 직접 고른 것보다 확실하지 않아 작게 바꾼다.
 * - 머리가 앞으로 나옴·몸이 미끄러짐: 등받이가 많이 누워 있으면 둘 다 생기므로 등받이를 세운다.
 * - 몸이 미끄러짐: 허리 받침이 모자라면 골반이 앞으로 빠지므로 허리 지지대를 조금 더 내민다.
 */
export function nudgesForSigns(signs: readonly PostureSign[]): SeatNudge[] {
  if (signs.length === 0) return [];
  const nudges: SeatNudge[] = [
    {
      axis: "backrest",
      direction: "increase",
      amount: signs.length > 1 ? "medium" : "small",
    },
  ];
  if (signs.includes("slumped"))
    nudges.push({ axis: "lumbar", direction: "increase", amount: "small" });
  return nudges;
}

// [이어 쓸 때, 끝맺을 때]
const SIGN_PHRASE: Record<PostureSign, readonly [string, string]> = {
  headForward: ["머리가 앞으로 나오고", "머리가 앞으로 나왔어요"],
  slumped: ["몸이 아래로 미끄러지고", "몸이 아래로 미끄러졌어요"],
};

/** "50분쯤", "1시간 10분쯤", "40초쯤" */
export function describeElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}초쯤`;
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}분쯤`;
  return minutes === 0 ? `${hours}시간쯤` : `${hours}시간 ${minutes}분쯤`;
}

/** 예: "출발하고 50분쯤부터 머리가 앞으로 나오고 몸이 아래로 미끄러졌어요" */
export function describePosture(report: PostureReport): string {
  if (report.driftAfterMs === null || report.signs.length === 0)
    return "도착할 때까지 출발할 때 자세를 잘 유지했어요";
  const sentence = report.signs
    .map(
      (sign, index) =>
        SIGN_PHRASE[sign][index === report.signs.length - 1 ? 1 : 0],
    )
    .join(" ");
  return `출발하고 ${describeElapsed(report.driftAfterMs)}부터 ${sentence}`;
}

// 시연용 모의 표본 (에뮬레이터 카메라는 고정 사진이라 자세가 변하지 않는다).
// 주행의 55% 지점부터 머리가 앞으로 나오고 몸이 미끄러지는 모습을 만든다.
const DEMO_WIDTH = 640;
const DEMO_HEIGHT = 480;
const DEMO_DRIFT_FROM = 0.55;
const DEMO_SAMPLE_GAP_MS = 5000;
const DEMO_MAX_SAMPLES = 240;

export function demoPostureSamples(
  startedAt: number,
  endedAt: number,
): PostureSample[] {
  const driveMs = Math.max(endedAt - startedAt, 0);
  const count = Math.min(
    DEMO_MAX_SAMPLES,
    Math.max(24, Math.floor(driveMs / DEMO_SAMPLE_GAP_MS)),
  );
  const samples: PostureSample[] = [];
  for (let i = 0; i < count; i += 1) {
    const progress = count === 1 ? 0 : i / (count - 1);
    // 0 → 1 로 서서히 무너진다.
    const drift = Math.min(
      1,
      Math.max(0, (progress - DEMO_DRIFT_FROM) / (1 - DEMO_DRIFT_FROM) / 0.4),
    );
    const shoulderY = 300 + 26 * drift;
    const earY = 180 + 52 * drift;
    const earHalf = 40 + 7 * drift;
    const point = (name: PoseLandmarkName, x: number, y: number) => ({
      name,
      x,
      y,
      likelihood: 0.99,
    });
    samples.push({
      at: Math.round(startedAt + driveMs * progress),
      width: DEMO_WIDTH,
      height: DEMO_HEIGHT,
      landmarks: [
        point("nose", 320, earY + 10),
        point("leftEar", 320 - earHalf, earY),
        point("rightEar", 320 + earHalf, earY),
        point("leftShoulder", 220, shoulderY),
        point("rightShoulder", 420, shoulderY),
      ],
    });
  }
  return samples;
}
