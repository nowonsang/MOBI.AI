import type {
  PoseLandmarkName,
  PostureSample as CameraSample,
} from "@/shared/pose-camera/pose-camera.types";

import { summarizePostureDrive } from "./bodyfit-posture";
import {
  demoCameraSamples,
  poseFrame,
  toPostureDrive,
} from "./bodyfit-posture-camera";
import { poseSampleSchema, postureDriveSchema } from "./bodyfit.schema";

const MINUTE = 60 * 1000;
const START = 1_000_000_000;
// 어깨 폭 200px, 키 170cm → 어깨 폭 약 44cm → 1cm ≈ 4.54px
const HEIGHT_CM = 170;
const PX_PER_CM = 200 / (HEIGHT_CM * 0.259);

type Pose = {
  earY?: number;
  shoulderY?: number;
  hipY?: number;
  hips?: boolean;
};

const frame = (at: number, pose: Pose = {}): CameraSample => {
  const { earY = 180, shoulderY = 300, hipY = 470, hips = true } = pose;
  const point = (name: PoseLandmarkName, x: number, y: number) => ({
    name,
    x,
    y,
    likelihood: 0.99,
  });
  return {
    at,
    width: 640,
    height: 480,
    landmarks: [
      point("nose", 320, earY + 10),
      point("leftEar", 280, earY),
      point("rightEar", 360, earY),
      point("leftShoulder", 220, shoulderY),
      point("rightShoulder", 420, shoulderY),
      ...(hips
        ? [point("leftHip", 250, hipY), point("rightHip", 390, hipY)]
        : []),
    ],
  };
};

/** 15초마다 표본. poseAt 으로 출발 후 분마다의 자세를 정한다. */
const drive = (
  minutes: number,
  poseAt: (minute: number) => Pose = () => ({}),
) =>
  Array.from({ length: minutes * 4 + 1 }, (_, i) =>
    frame(START + i * 15_000, poseAt((i * 15_000) / MINUTE)),
  );

const toDrive = (samples: CameraSample[], minutes: number) =>
  toPostureDrive({
    profileId: "p1",
    context: "long",
    startedAt: START,
    endedAt: START + minutes * MINUTE,
    heightCm: HEIGHT_CM,
    samples,
  });

describe("poseFrame", () => {
  it("어깨·머리·골반의 화면 위치를 뽑는다", () => {
    expect(poseFrame(frame(0))).toEqual({
      shoulderWidth: 200,
      neck: 120,
      shoulderY: 300,
      torso: 170,
    });
  });

  it("골반이 안 보이면 등 길이는 비워 둔다", () => {
    expect(poseFrame(frame(0, { hips: false }))?.torso).toBeNull();
  });

  it("어깨가 안 보이면 쓰지 않는다", () => {
    expect(poseFrame({ width: 640, height: 480, landmarks: [] })).toBeNull();
  });
});

describe("toPostureDrive", () => {
  it("표본이 모자라면 기록하지 않는다", () => {
    expect(toDrive([frame(START), frame(START + MINUTE)], 10)).toBeNull();
  });

  it("자세가 그대로면 분마다 변화가 0 이고 쏠림이 없다", () => {
    const result = toDrive(drive(30), 30);
    expect(result?.durationMin).toBe(30);
    expect(result?.samples.every((s) => s.headForwardCm === 0)).toBe(true);
    expect(summarizePostureDrive(result!).driftStartMin).toBeNull();
  });

  it("머리가 내려오고 어깨가 처지면 cm 로 바꿔 남기고, 리포트가 그때부터 쏠림으로 본다", () => {
    const result = toDrive(
      drive(60, (minute) =>
        minute >= 30 ? { earY: 220, shoulderY: 318, hipY: 488 } : {},
      ),
      60,
    );
    const late = result?.samples.find((s) => s.minute === 40);
    // 목 높이(어깨 - 귀)가 120px → 98px 로 22px 줄었다 → 약 4.8cm
    expect(late?.headForwardCm).toBeCloseTo(22 / PX_PER_CM, 0);
    expect(late?.shoulderDropCm).toBeCloseTo(18 / PX_PER_CM, 0);
    // 골반도 같이 내려가 등 길이는 그대로 → 숙이지 않았다
    expect(late?.backLeanDeg).toBe(0);
    expect(summarizePostureDrive(result!).driftStartMin).toBe(30);
  });

  it("상체가 앞으로 숙으면 등 각도를 낸다 (작은 흔들림은 0)", () => {
    const leaned = toDrive(
      drive(20, (minute) => (minute >= 10 ? { hipY: 465 } : {})),
      20,
    );
    // 등 길이 170 → 165 (97%) → 약 14°
    expect(leaned?.samples.at(-1)?.backLeanDeg).toBeCloseTo(13.9, 0);
    const wobble = toDrive(
      drive(20, (minute) => (minute >= 10 ? { hipY: 468 } : {})),
      20,
    );
    expect(wobble?.samples.at(-1)?.backLeanDeg).toBe(0);
  });

  it("출발 직전 1분보다 오래된 표본과 도착 뒤 표본은 쓰지 않는다", () => {
    const samples = [
      frame(START - 5 * MINUTE, { earY: 260 }),
      ...drive(10),
      frame(START + 11 * MINUTE, { earY: 260 }),
    ];
    const result = toDrive(samples, 10);
    expect(result?.samples.every((s) => s.minute <= 10)).toBe(true);
    expect(result?.samples.every((s) => s.headForwardCm === 0)).toBe(true);
  });

  it("기록은 저장 형식을 지킨다", () => {
    const result = toDrive(
      drive(60, (minute) => (minute >= 30 ? { earY: 230 } : {})),
      60,
    );
    expect(postureDriveSchema.safeParse(result).success).toBe(true);
  });
});

describe("demoCameraSamples", () => {
  const ended = START + 10 * MINUTE;
  const { startedAt, samples } = demoCameraSamples(ended);

  it("도착 시각까지 이어진 한 시간짜리 주행이고, 네이티브 표본과 같은 형식이다", () => {
    expect(ended - startedAt).toBe(60 * MINUTE);
    for (const item of samples)
      expect(poseSampleSchema.safeParse(item).success).toBe(true);
  });

  it("리포트가 주행 후반부터 쏠렸다고 본다", () => {
    const result = toPostureDrive({
      profileId: "p1",
      context: "long",
      startedAt,
      endedAt: ended,
      heightCm: HEIGHT_CM,
      samples,
      sample: true,
    });
    expect(result?.sample).toBe(true);
    const report = summarizePostureDrive(result!);
    expect(report.driftStartMin).toBeGreaterThanOrEqual(33);
    expect(report.driftStartMin).toBeLessThanOrEqual(40);
    expect(report.change.headForwardCm).toBeGreaterThanOrEqual(3);
    expect(report.change.backLeanDeg).toBeGreaterThanOrEqual(4);
  });
});
