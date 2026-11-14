import { z } from "zod";

import {
  POSE_LANDMARK_NAMES,
  type PoseCapture,
  type PoseLandmarkName,
} from "@/shared/pose-camera/pose-camera.types";

import { SITTING_HEIGHT_RATIO } from "./bodyfit-recommend";
import { clamp } from "./bodyfit-seat";
import { HEIGHT_CM_RANGE, SITTING_HEIGHT_CM_RANGE } from "./bodyfit.schema";

/*
 * 카메라로 앉은키 추정 (A-5).
 *
 * 카메라(ML Kit Pose Detection)는 사진 속 관절 위치만 준다. 사진에는 길이 단위가 없으므로 키·몸무게는 잴 수 없고,
 * 앉은키도 직접 재지 못한다. 그래서 "운전자가 입력한 키"를 자로 삼고, 서 있는 전신 사진에서
 * 상체(눈→엉덩이 관절)와 하체(엉덩이 관절→발목)의 길이 비율만 읽어 앉은키를 추정한다.
 *
 * 근거 (서 있는 성인의 평균 마디 높이, 키 H 대비. Drillis & Contini 1966 의 인체 비율표):
 *   눈 0.936H · 엉덩이 관절(대전자) 0.530H · 발목 0.039H
 *   → 사진의 눈~발목 길이는 실제 0.897H 에 해당한다 (이것이 사진의 축척이 된다)
 *   → 평균 체형의 상체 비율 r = (눈→엉덩이) / (눈→발목) = 0.406 / 0.897 ≈ 0.4526
 *
 * 추정식: 앉은키 = H × (0.53 + 0.897 × (r − 0.4526))
 *   - 0.53 은 앉은키를 비웠을 때 쓰는 평균 비율이다 (bodyfit-recommend.ts 의 SITTING_HEIGHT_RATIO).
 *     그래서 평균 비율인 사람은 카메라로 재도 비워 둔 것과 같은 값이 나온다.
 *   - 상체가 평균보다 긴 만큼(r 이 큰 만큼)만 더하고, 짧은 만큼만 뺀다.
 *   - 정수리~눈, 엉덩이 관절~좌판 길이는 사진에서 읽을 수 없어 평균값으로 둔다 (0.53 안에 들어 있다).
 *
 * 한계 (화면 문구에도 "추정값"이라고 밝힌다):
 *   - 실제 사람으로 오차를 검증하지 않았다. ML Kit 의 엉덩이·발목 점이 해부학적 위치와 얼마나 다른지도 재지 않았다.
 *     키의 53% 로 추정하는 것보다 정확하다는 근거는 아직 없다. 그래서 운전자가 확인·수정한 뒤에만 저장한다.
 *   - 운전석에 앉은 채로는 다리가 가려져 축척을 잡을 수 없다. 그때는 값을 내지 않는다 (lowerBodyHidden·notStanding).
 *   - 이 값만으로 시트를 움직이지 않는다. 입력 칸을 미리 채우는 데만 쓴다.
 */

const EYE_HEIGHT_RATIO = 0.936;
const HIP_HEIGHT_RATIO = 0.53;
const ANKLE_HEIGHT_RATIO = 0.039;
/** 사진의 눈~발목 길이가 실제 키에서 차지하는 비율 */
const EYE_TO_ANKLE_RATIO = EYE_HEIGHT_RATIO - ANKLE_HEIGHT_RATIO;
/** 평균 체형의 상체 비율 (눈→엉덩이 관절) / (눈→발목) */
export const AVERAGE_TORSO_RATIO =
  (EYE_HEIGHT_RATIO - HIP_HEIGHT_RATIO) / EYE_TO_ANKLE_RATIO;

// 이 가능성보다 낮은 관절은 "안 보인다"로 본다 (ML Kit inFrameLikelihood).
const MIN_LIKELIHOOD = 0.7;
// 사람이 사진 높이의 이만큼은 차지해야 한다. 더 작으면 관절 위치 오차가 비율을 흔든다.
const MIN_BODY_SPAN = 0.35;
// 서 있으면 허벅지와 정강이의 세로 길이가 비슷하다(약 1:1). 앉으면 허벅지가 눕는다.
const MIN_THIGH_TO_SHANK = 0.6;
// 눈과 발목이 좌우로 이만큼(몸 길이 대비) 넘게 어긋나면 기울어 선 것으로 본다.
const MAX_LEAN = 0.25;
// 사람의 앉은키 비율은 대략 0.50~0.56 이다. 이 범위를 넘으면 관절이 잘못 잡힌 것으로 보고 값을 내지 않는다.
const PLAUSIBLE_SITTING_RATIO = { min: 0.48, max: 0.58 };

// 네이티브 모듈에서 온 값도 신뢰하지 않는 입력으로 다룬다: 형식·범위를 검증한 뒤에만 계산에 쓴다.
const MAX_IMAGE_SIDE = 10_000;
const landmarkSchema = z.object({
  name: z.enum(POSE_LANDMARK_NAMES),
  // 화면 밖으로 추정된 관절은 범위를 조금 벗어날 수 있다.
  x: z.number().min(-MAX_IMAGE_SIDE).max(2 * MAX_IMAGE_SIDE),
  y: z.number().min(-MAX_IMAGE_SIDE).max(2 * MAX_IMAGE_SIDE),
  likelihood: z.number().min(0).max(1),
});

export const poseCaptureSchema = z.object({
  width: z.number().positive().max(MAX_IMAGE_SIDE),
  height: z.number().positive().max(MAX_IMAGE_SIDE),
  landmarks: z.array(landmarkSchema).max(POSE_LANDMARK_NAMES.length),
});

export type BodyScanFailure =
  /** 키가 없거나 범위를 벗어났다 (키가 자 역할을 한다) */
  | "heightMissing"
  /** 관절 데이터 형식이 맞지 않는다 */
  | "invalidData"
  /** 사람을 찾지 못했다 */
  | "noPerson"
  /** 눈이 보이지 않는다 */
  | "faceHidden"
  /** 엉덩이나 발목이 보이지 않는다 (운전석에 앉아 있거나 화면 밖) */
  | "lowerBodyHidden"
  /** 서 있는 자세가 아니다 (앉았거나 기울었다) */
  | "notStanding"
  /** 사람이 너무 작게 찍혔다 */
  | "tooSmall"
  /** 계산한 비율이 사람의 범위를 벗어났다 (관절이 잘못 잡혔다) */
  | "implausible";

export type BodyScanResult =
  | {
      ok: true;
      /** 1cm 단위로 반올림한 추정값. 스키마 범위(60~120cm) 안이다 */
      sittingHeightCm: number;
      /** 사진에서 읽은 상체 비율 (눈→엉덩이) / (눈→발목) */
      torsoRatio: number;
    }
  | { ok: false; reason: BodyScanFailure };

const fail = (reason: BodyScanFailure): BodyScanResult => ({
  ok: false,
  reason,
});

type Point = { x: number; y: number };

/** 양쪽 관절이 모두 보일 때만 그 가운데 점을 돌려준다. */
function midpoint(
  capture: PoseCapture,
  left: PoseLandmarkName,
  right: PoseLandmarkName,
): Point | null {
  const visible = (name: PoseLandmarkName) =>
    capture.landmarks.find(
      (landmark) =>
        landmark.name === name && landmark.likelihood >= MIN_LIKELIHOOD,
    );
  const a = visible(left);
  const b = visible(right);
  return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
}

/**
 * 관절 좌표와 운전자가 입력한 키로 앉은키를 추정한다. 필요한 관절이 안 보이거나 자세가 맞지 않으면
 * 값을 내지 않고 이유를 돌려준다.
 */
export function estimateSittingHeight(
  rawCapture: unknown,
  heightCm: number,
): BodyScanResult {
  if (
    !Number.isFinite(heightCm) ||
    heightCm < HEIGHT_CM_RANGE.min ||
    heightCm > HEIGHT_CM_RANGE.max
  ) {
    return fail("heightMissing");
  }
  const parsed = poseCaptureSchema.safeParse(rawCapture);
  if (!parsed.success) return fail("invalidData");
  const capture = parsed.data;
  if (capture.landmarks.length === 0) return fail("noPerson");

  const eye = midpoint(capture, "leftEye", "rightEye");
  if (!eye) return fail("faceHidden");
  // 운전석에 앉으면 엉덩이·다리가 가려진다. 가장 흔한 실패라 따로 알린다.
  const hip = midpoint(capture, "leftHip", "rightHip");
  const ankle = midpoint(capture, "leftAnkle", "rightAnkle");
  if (!hip || !ankle) return fail("lowerBodyHidden");

  // 사진 좌표는 아래로 갈수록 y 가 커진다.
  const torso = hip.y - eye.y;
  const leg = ankle.y - hip.y;
  const body = ankle.y - eye.y;
  if (torso <= 0 || leg <= 0) return fail("notStanding");
  if (body < capture.height * MIN_BODY_SPAN) return fail("tooSmall");
  if (Math.abs(eye.x - ankle.x) > body * MAX_LEAN) return fail("notStanding");

  // 무릎이 보이면 앉은 자세를 걸러 낸다. 앉으면 허벅지가 누워 세로 길이가 줄어든다.
  const knee = midpoint(capture, "leftKnee", "rightKnee");
  if (knee) {
    const thigh = knee.y - hip.y;
    const shank = ankle.y - knee.y;
    if (shank <= 0 || thigh < shank * MIN_THIGH_TO_SHANK) {
      return fail("notStanding");
    }
  }

  const torsoRatio = torso / body;
  const sittingRatio =
    SITTING_HEIGHT_RATIO +
    EYE_TO_ANKLE_RATIO * (torsoRatio - AVERAGE_TORSO_RATIO);
  if (
    sittingRatio < PLAUSIBLE_SITTING_RATIO.min ||
    sittingRatio > PLAUSIBLE_SITTING_RATIO.max
  ) {
    return fail("implausible");
  }

  return {
    ok: true,
    sittingHeightCm: clamp(
      Math.round(heightCm * sittingRatio),
      SITTING_HEIGHT_CM_RANGE.min,
      SITTING_HEIGHT_CM_RANGE.max,
    ),
    torsoRatio,
  };
}

/** 화면에 그리는 뼈대 (사진 대신 관절 점과 선만 보여 준다) */
const POSE_BONES: readonly (readonly [PoseLandmarkName, PoseLandmarkName])[] = [
  ["leftEye", "rightEye"],
  ["leftShoulder", "rightShoulder"],
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["leftShoulder", "leftHip"],
  ["rightShoulder", "rightHip"],
  ["leftHip", "rightHip"],
  ["leftHip", "leftKnee"],
  ["leftKnee", "leftAnkle"],
  ["rightHip", "rightKnee"],
  ["rightKnee", "rightAnkle"],
];

/** 뼈대에 쓰는 관절만 점으로 그린다 (손가락·입 같은 잔점은 뺀다) */
const FIGURE_JOINTS = new Set<PoseLandmarkName>(POSE_BONES.flat());

export type PoseFigure = {
  /** 가로 ÷ 세로 */
  aspectRatio: number;
  /** 사진 크기 대비 0~1 위치 */
  joints: { name: PoseLandmarkName; x: number; y: number }[];
  bones: { from: Point; to: Point }[];
};

/**
 * 관절 좌표를 화면에 그릴 뼈대로 바꾼다. 잘 보이는 관절만 쓰고, 형식이 맞지 않거나 그릴 관절이 없으면 null.
 */
export function toPoseFigure(rawCapture: unknown): PoseFigure | null {
  const parsed = poseCaptureSchema.safeParse(rawCapture);
  if (!parsed.success) return null;
  const { width, height, landmarks } = parsed.data;

  const points = new Map<PoseLandmarkName, Point>();
  for (const landmark of landmarks) {
    const x = landmark.x / width;
    const y = landmark.y / height;
    if (
      FIGURE_JOINTS.has(landmark.name) &&
      landmark.likelihood >= MIN_LIKELIHOOD &&
      x >= 0 &&
      x <= 1 &&
      y >= 0 &&
      y <= 1
    ) {
      points.set(landmark.name, { x, y });
    }
  }
  if (points.size === 0) return null;

  return {
    aspectRatio: width / height,
    joints: [...points].map(([name, point]) => ({ name, ...point })),
    bones: POSE_BONES.flatMap(([a, b]) => {
      const from = points.get(a);
      const to = points.get(b);
      return from && to ? [{ from, to }] : [];
    }),
  };
}

/*
 * 시연용 샘플 자세. 실제 사람을 찍은 데이터가 아니라, 위의 인체 비율표로 만든 서 있는 사람의 관절 좌표다
 * (720×1280 사진, 눈 y=200, 발목 y=1100). 엉덩이를 평균(y≈607)보다 조금 낮게 두어 상체가 약간 긴 체형이다.
 * 카메라가 없는 기기(에뮬레이터)에서 "촬영 → 추정 → 입력 칸 채움" 흐름을 보여 줄 때만 쓴다.
 */
const sample = (
  name: PoseLandmarkName,
  x: number,
  y: number,
): PoseCapture["landmarks"][number] => ({ name, x, y, likelihood: 0.98 });

export const SAMPLE_POSE_CAPTURE: PoseCapture = {
  width: 720,
  height: 1280,
  landmarks: [
    sample("nose", 360, 225),
    sample("leftEye", 382, 200),
    sample("rightEye", 338, 200),
    sample("leftEar", 405, 208),
    sample("rightEar", 315, 208),
    sample("leftShoulder", 462, 318),
    sample("rightShoulder", 258, 318),
    sample("leftElbow", 484, 505),
    sample("rightElbow", 236, 505),
    sample("leftWrist", 494, 651),
    sample("rightWrist", 226, 651),
    sample("leftHip", 420, 614),
    sample("rightHip", 300, 614),
    sample("leftKnee", 416, 857),
    sample("rightKnee", 304, 857),
    sample("leftAnkle", 412, 1100),
    sample("rightAnkle", 308, 1100),
    sample("leftHeel", 408, 1122),
    sample("rightHeel", 312, 1122),
    sample("leftFootIndex", 432, 1136),
    sample("rightFootIndex", 288, 1136),
  ],
};
