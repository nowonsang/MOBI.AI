import type {
  PoseLandmarkName,
  PostureSample,
} from "@/shared/pose-camera/pose-camera.types";

import {
  analyzePosture,
  demoPostureSamples,
  describeElapsed,
  describePosture,
  nudgesForSigns,
  postureFeatures,
} from "./bodyfit-posture";
import { postureReportSchema, postureSampleSchema } from "./bodyfit.schema";

const MINUTE = 60 * 1000;
const START = 1_000_000;

type Pose = {
  earY?: number;
  earHalf?: number;
  shoulderY?: number;
  likelihood?: number;
  ears?: boolean;
};

const sample = (at: number, pose: Pose = {}): PostureSample => {
  const {
    earY = 180,
    earHalf = 40,
    shoulderY = 300,
    likelihood = 0.99,
    ears = true,
  } = pose;
  const point = (name: PoseLandmarkName, x: number, y: number) => ({
    name,
    x,
    y,
    likelihood,
  });
  return {
    at,
    width: 640,
    height: 480,
    landmarks: [
      point("nose", 320, earY + 10),
      ...(ears
        ? [
            point("leftEar", 320 - earHalf, earY),
            point("rightEar", 320 + earHalf, earY),
          ]
        : []),
      point("leftShoulder", 220, shoulderY),
      point("rightShoulder", 420, shoulderY),
    ],
  };
};

/** 주행 시간 동안 5초마다 표본을 만든다. poseAt 으로 시각별 자세를 정한다. */
const drive = (
  driveMs: number,
  poseAt: (progress: number) => Pose = () => ({}),
): PostureSample[] => {
  const samples: PostureSample[] = [];
  for (let t = 0; t <= driveMs; t += 5000) {
    // 사람은 가만히 있어도 조금씩 흔들린다.
    const jitter = (t / 5000) % 2 === 0 ? 0 : 1;
    const pose = poseAt(t / driveMs);
    samples.push(
      sample(START + t, { ...pose, earY: (pose.earY ?? 180) + jitter }),
    );
  }
  return samples;
};

describe("postureFeatures", () => {
  it("어깨 폭에 대한 비율로 목 높이·머리 크기를 계산한다", () => {
    const features = postureFeatures(sample(0));
    expect(features?.neck).toBeCloseTo(0.6);
    expect(features?.headScale).toBeCloseTo(0.4);
    expect(features?.shoulderLevel).toBeCloseTo(300 / 480);
  });

  it("귀가 안 보이면 코로 목 높이를 재고 머리 크기는 비워 둔다", () => {
    const features = postureFeatures(sample(0, { ears: false }));
    expect(features?.neck).toBeCloseTo((300 - 190) / 200);
    expect(features?.headScale).toBeNull();
  });

  it("어깨가 보이지 않거나 확실하지 않으면 쓰지 않는다", () => {
    expect(postureFeatures(sample(0, { likelihood: 0.3 }))).toBeNull();
    expect(
      postureFeatures({ width: 640, height: 480, landmarks: [] }),
    ).toBeNull();
  });
});

describe("analyzePosture", () => {
  const analyze = (samples: PostureSample[], driveMs: number) =>
    analyzePosture({
      profileId: "p1",
      samples,
      startedAt: START,
      endedAt: START + driveMs,
    });

  it("표본이 모자라면 판단하지 않는다", () => {
    expect(analyze(drive(20 * 1000), 20 * 1000)).toBeNull();
  });

  it("끝까지 자세가 같으면 무너진 때가 없다", () => {
    const report = analyze(drive(10 * MINUTE), 10 * MINUTE);
    expect(report).toMatchObject({
      driftAfterMs: null,
      signs: [],
      nudges: [],
    });
  });

  it("중간부터 계속 무너지면 그 때와 모습을 찾는다", () => {
    const report = analyze(
      drive(60 * MINUTE, (progress) =>
        progress >= 0.5 ? { earY: 215, earHalf: 46, shoulderY: 326 } : {},
      ),
      60 * MINUTE,
    );
    expect(report?.driftAfterMs).toBe(30 * MINUTE);
    expect(report?.signs).toEqual(["headForward", "slumped"]);
    expect(report?.nudges).toEqual([
      { axis: "backrest", direction: "increase", amount: "medium" },
      { axis: "lumbar", direction: "increase", amount: "small" },
    ]);
  });

  it("잠깐 숙였다가 돌아오면 무너진 것으로 보지 않는다", () => {
    const report = analyze(
      drive(60 * MINUTE, (progress) =>
        progress >= 0.4 && progress < 0.5 ? { earY: 230 } : {},
      ),
      60 * MINUTE,
    );
    expect(report?.driftAfterMs).toBeNull();
  });

  it("마지막 한 구간만 무너진 것은 무시한다", () => {
    const report = analyze(
      drive(60 * MINUTE, (progress) => (progress >= 0.9 ? { earY: 230 } : {})),
      60 * MINUTE,
    );
    expect(report?.driftAfterMs).toBeNull();
  });

  it("출발 직전 1분보다 오래된 표본과 도착 뒤 표본은 쓰지 않는다", () => {
    const samples = [
      sample(START - 5 * MINUTE, { earY: 260 }),
      ...drive(10 * MINUTE),
      sample(START + 11 * MINUTE, { earY: 260 }),
    ];
    const report = analyze(samples, 10 * MINUTE);
    expect(report?.sampleCount).toBe(drive(10 * MINUTE).length);
    expect(report?.driftAfterMs).toBeNull();
  });

  it("결과는 저장 형식을 지킨다", () => {
    const report = analyze(
      drive(60 * MINUTE, (progress) =>
        progress >= 0.5 ? { shoulderY: 330 } : {},
      ),
      60 * MINUTE,
    );
    expect(report?.signs).toEqual(["slumped"]);
    expect(postureReportSchema.safeParse(report).success).toBe(true);
  });
});

describe("demoPostureSamples", () => {
  it("주행 후반부터 무너지는 결과가 나온다 (1분 시연 주행)", () => {
    const samples = demoPostureSamples(START, START + MINUTE);
    const report = analyzePosture({
      profileId: "p1",
      samples,
      startedAt: START,
      endedAt: START + MINUTE,
      demo: true,
    });
    expect(report?.demo).toBe(true);
    expect(report?.signs).toEqual(["headForward", "slumped"]);
    expect(report?.driftAfterMs).toBeGreaterThanOrEqual(0.5 * MINUTE);
    expect(report?.driftAfterMs).toBeLessThanOrEqual(0.8 * MINUTE);
  });

  it("표본은 네이티브 표본과 같은 형식이다", () => {
    for (const item of demoPostureSamples(START, START + MINUTE))
      expect(postureSampleSchema.safeParse(item).success).toBe(true);
  });
});

describe("nudgesForSigns", () => {
  it("한 가지만 보이면 등받이를 조금 세운다", () => {
    expect(nudgesForSigns(["headForward"])).toEqual([
      { axis: "backrest", direction: "increase", amount: "small" },
    ]);
  });

  it("아무것도 없으면 바꾸지 않는다", () => {
    expect(nudgesForSigns([])).toEqual([]);
  });
});

describe("describe", () => {
  it("경과 시간을 짧게 읽는다", () => {
    expect(describeElapsed(40 * 1000)).toBe("40초쯤");
    expect(describeElapsed(50 * MINUTE)).toBe("50분쯤");
    expect(describeElapsed(60 * MINUTE)).toBe("1시간쯤");
    expect(describeElapsed(70 * MINUTE)).toBe("1시간 10분쯤");
  });

  it("무너진 때와 모습을 한 문장으로 말한다", () => {
    const base = {
      profileId: "p1",
      endedAt: 0,
      driveMs: 0,
      sampleCount: 10,
      nudges: [],
      demo: false,
    };
    expect(
      describePosture({
        ...base,
        driftAfterMs: 50 * MINUTE,
        signs: ["headForward", "slumped"],
      }),
    ).toBe("출발하고 50분쯤부터 머리가 앞으로 나오고 몸이 아래로 미끄러졌어요");
    expect(
      describePosture({
        ...base,
        driftAfterMs: 50 * MINUTE,
        signs: ["slumped"],
      }),
    ).toBe("출발하고 50분쯤부터 몸이 아래로 미끄러졌어요");
    expect(describePosture({ ...base, driftAfterMs: null, signs: [] })).toBe(
      "도착할 때까지 출발할 때 자세를 잘 유지했어요",
    );
  });
});
