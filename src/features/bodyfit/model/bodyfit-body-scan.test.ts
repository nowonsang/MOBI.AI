import {
  POSE_LANDMARK_NAMES,
  type PoseCapture,
  type PoseLandmarkName,
} from "@/shared/pose-camera/pose-camera.types";

import {
  AVERAGE_TORSO_RATIO,
  SAMPLE_POSE_CAPTURE,
  estimateSittingHeight,
  toPoseFigure,
} from "./bodyfit-body-scan";
import { SITTING_HEIGHT_RATIO } from "./bodyfit-recommend";
import { SITTING_HEIGHT_CM_RANGE } from "./bodyfit.schema";

const EYE_Y = 200;
const ANKLE_Y = 1100;

type Overrides = Partial<
  Record<PoseLandmarkName, { x?: number; y?: number; likelihood?: number }>
>;

/** 서 있는 사람. torsoRatio = (눈→엉덩이) / (눈→발목). 무릎은 엉덩이와 발목의 가운데. */
function standing(
  torsoRatio: number,
  overrides: Overrides = {},
  without: PoseLandmarkName[] = [],
): PoseCapture {
  const hipY = EYE_Y + torsoRatio * (ANKLE_Y - EYE_Y);
  const kneeY = (hipY + ANKLE_Y) / 2;
  const base: [PoseLandmarkName, number, number][] = [
    ["leftEye", 382, EYE_Y],
    ["rightEye", 338, EYE_Y],
    ["leftShoulder", 462, 318],
    ["rightShoulder", 258, 318],
    ["leftHip", 420, hipY],
    ["rightHip", 300, hipY],
    ["leftKnee", 416, kneeY],
    ["rightKnee", 304, kneeY],
    ["leftAnkle", 412, ANKLE_Y],
    ["rightAnkle", 308, ANKLE_Y],
  ];
  return {
    width: 720,
    height: 1280,
    landmarks: base
      .filter(([name]) => !without.includes(name))
      .map(([name, x, y]) => ({
        name,
        x,
        y,
        likelihood: 0.95,
        ...overrides[name],
      })),
  };
}

const reasonOf = (capture: unknown, heightCm = 175) => {
  const result = estimateSittingHeight(capture, heightCm);
  return result.ok ? null : result.reason;
};

describe("estimateSittingHeight", () => {
  it("평균 비율인 사람은 앉은키를 비웠을 때와 같은 값(키의 53%)이 나온다", () => {
    const result = estimateSittingHeight(standing(AVERAGE_TORSO_RATIO), 175);
    expect(result).toMatchObject({
      ok: true,
      sittingHeightCm: Math.round(175 * SITTING_HEIGHT_RATIO),
    });
  });

  it("상체가 길게 찍힐수록 앉은키를 크게 추정한다", () => {
    const short = estimateSittingHeight(standing(0.43), 175);
    const long = estimateSittingHeight(standing(0.48), 175);
    if (!short.ok || !long.ok) throw new Error("추정 실패");
    expect(long.sittingHeightCm).toBeGreaterThan(short.sittingHeightCm);
  });

  it("같은 관절 비율이면 입력한 키에 비례한다", () => {
    const small = estimateSittingHeight(standing(0.46), 160);
    const tall = estimateSittingHeight(standing(0.46), 190);
    if (!small.ok || !tall.ok) throw new Error("추정 실패");
    expect(tall.sittingHeightCm / small.sittingHeightCm).toBeCloseTo(
      190 / 160,
      1,
    );
  });

  it("추정값은 정수 cm 이고 스키마 범위(60~120cm) 안이다", () => {
    for (const heightCm of [120, 150, 175, 200, 220]) {
      for (const ratio of [0.41, 0.4526, 0.5]) {
        const result = estimateSittingHeight(standing(ratio), heightCm);
        if (!result.ok) continue;
        expect(Number.isInteger(result.sittingHeightCm)).toBe(true);
        expect(result.sittingHeightCm).toBeGreaterThanOrEqual(
          SITTING_HEIGHT_CM_RANGE.min,
        );
        expect(result.sittingHeightCm).toBeLessThanOrEqual(
          SITTING_HEIGHT_CM_RANGE.max,
        );
      }
    }
  });

  it("키가 아주 커서 범위를 넘는 값은 120cm 로 자른다", () => {
    expect(estimateSittingHeight(standing(0.5), 220)).toMatchObject({
      ok: true,
      sittingHeightCm: 120,
    });
  });

  it("키가 없거나 범위를 벗어나면 값을 내지 않는다", () => {
    const capture = standing(AVERAGE_TORSO_RATIO);
    expect(reasonOf(capture, Number.NaN)).toBe("heightMissing");
    expect(reasonOf(capture, 90)).toBe("heightMissing");
    expect(reasonOf(capture, 260)).toBe("heightMissing");
  });

  it("형식이 맞지 않는 관절 데이터는 받지 않는다", () => {
    expect(reasonOf(null)).toBe("invalidData");
    expect(reasonOf({ width: 720, height: 1280 })).toBe("invalidData");
    expect(
      reasonOf({
        width: 720,
        height: 1280,
        landmarks: [{ name: "tail", x: 1, y: 1, likelihood: 1 }],
      }),
    ).toBe("invalidData");
    expect(
      reasonOf(standing(0.45, { leftHip: { y: Number.POSITIVE_INFINITY } })),
    ).toBe("invalidData");
    expect(reasonOf(standing(0.45, { leftHip: { likelihood: 1.5 } }))).toBe(
      "invalidData",
    );
  });

  it("사람을 찾지 못하면 값을 내지 않는다", () => {
    expect(reasonOf({ width: 720, height: 1280, landmarks: [] })).toBe(
      "noPerson",
    );
  });

  it("눈이 안 보이면 값을 내지 않는다", () => {
    expect(reasonOf(standing(0.45, {}, ["leftEye"]))).toBe("faceHidden");
    expect(reasonOf(standing(0.45, { rightEye: { likelihood: 0.3 } }))).toBe(
      "faceHidden",
    );
  });

  it("엉덩이나 발목이 안 보이면(앉아서 가려지면) 값을 내지 않는다", () => {
    expect(reasonOf(standing(0.45, { rightHip: { likelihood: 0.3 } }))).toBe(
      "lowerBodyHidden",
    );
    expect(
      reasonOf(
        standing(0.45, {}, [
          "leftHip",
          "rightHip",
          "leftKnee",
          "rightKnee",
          "leftAnkle",
          "rightAnkle",
        ]),
      ),
    ).toBe("lowerBodyHidden");
    expect(reasonOf(standing(0.45, {}, ["leftAnkle", "rightAnkle"]))).toBe(
      "lowerBodyHidden",
    );
    expect(reasonOf(standing(0.45, { leftAnkle: { likelihood: 0.2 } }))).toBe(
      "lowerBodyHidden",
    );
  });

  it("앉은 자세(허벅지가 누운 자세)는 걸러 낸다", () => {
    const hipY = EYE_Y + 0.45 * (ANKLE_Y - EYE_Y);
    const seated = standing(0.45, {
      leftKnee: { y: hipY + 40 },
      rightKnee: { y: hipY + 40 },
    });
    expect(reasonOf(seated)).toBe("notStanding");
  });

  it("몸이 크게 기울었거나 위아래가 뒤집히면 걸러 낸다", () => {
    expect(
      reasonOf(
        standing(0.45, { leftEye: { x: 700 }, rightEye: { x: 660 } }),
      ),
    ).toBe("notStanding");
    expect(
      reasonOf(standing(0.45, { leftHip: { y: 100 }, rightHip: { y: 100 } })),
    ).toBe("notStanding");
  });

  it("사람이 너무 작게 찍히면 값을 내지 않는다", () => {
    const far = standing(0.45);
    const shrunk: PoseCapture = {
      ...far,
      landmarks: far.landmarks.map((landmark) => ({
        ...landmark,
        y: 600 + (landmark.y - EYE_Y) * 0.2,
      })),
    };
    expect(reasonOf(shrunk)).toBe("tooSmall");
  });

  it("사람의 범위를 벗어난 비율은 관절이 잘못 잡힌 것으로 보고 값을 내지 않는다", () => {
    expect(reasonOf(standing(0.3, {}, ["leftKnee", "rightKnee"]))).toBe(
      "implausible",
    );
    expect(reasonOf(standing(0.62, {}, ["leftKnee", "rightKnee"]))).toBe(
      "implausible",
    );
  });
});

describe("SAMPLE_POSE_CAPTURE", () => {
  it("샘플 자세는 추정에 성공하고 평균보다 조금 큰 값을 낸다", () => {
    const result = estimateSittingHeight(SAMPLE_POSE_CAPTURE, 175);
    if (!result.ok) throw new Error(`샘플 추정 실패: ${result.reason}`);
    expect(result.sittingHeightCm).toBe(94);
    expect(result.torsoRatio).toBeGreaterThan(AVERAGE_TORSO_RATIO);
  });

  it("샘플 자세의 관절 이름은 네이티브 계약에 있는 이름이다", () => {
    for (const landmark of SAMPLE_POSE_CAPTURE.landmarks) {
      expect(POSE_LANDMARK_NAMES).toContain(landmark.name);
    }
  });
});

describe("toPoseFigure", () => {
  it("잘 보이는 관절을 0~1 위치의 점과 선으로 바꾼다", () => {
    const figure = toPoseFigure(SAMPLE_POSE_CAPTURE);
    expect(figure).not.toBeNull();
    expect(figure!.aspectRatio).toBeCloseTo(720 / 1280);
    expect(figure!.bones).toHaveLength(13);
    for (const joint of figure!.joints) {
      expect(joint.x).toBeGreaterThanOrEqual(0);
      expect(joint.x).toBeLessThanOrEqual(1);
      expect(joint.y).toBeGreaterThanOrEqual(0);
      expect(joint.y).toBeLessThanOrEqual(1);
    }
  });

  it("안 보이는 관절과 그 관절에 이어진 선은 그리지 않는다", () => {
    const figure = toPoseFigure(
      standing(0.45, { leftKnee: { likelihood: 0.1 } }),
    );
    expect(figure!.joints.map((joint) => joint.name)).not.toContain(
      "leftKnee",
    );
    // 눈·어깨·어깨→엉덩이 2·엉덩이·오른쪽 다리 2 (팔과 왼쪽 다리는 없다)
    expect(figure!.bones).toHaveLength(7);
  });

  it("형식이 맞지 않거나 그릴 관절이 없으면 null 이다", () => {
    expect(toPoseFigure("pose")).toBeNull();
    expect(toPoseFigure({ width: 720, height: 1280, landmarks: [] })).toBeNull();
  });
});
