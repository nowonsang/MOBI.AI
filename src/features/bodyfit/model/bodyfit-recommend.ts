import { SEAT_AXES } from "@/shared/pleos/pleos.types";

import { clamp } from "./bodyfit-seat";
import type { BodyProfile, SeatAxis, SeatRatios } from "./bodyfit.types";

/**
 * 기본 추천이 없는 축 (허리 지지대·헤드레스트 각도).
 * 허리 지지대는 허리 곡선에, 헤드레스트 각도는 등받이 각도와 목 자세에 달려 있어 키·앉은키로 정할 근거가 없다.
 * 근거 없이 추천하면 허리를 밀거나 머리를 앞으로 미는 자세가 될 수 있다.
 * 그래서 처음에는 지금 위치를 그대로 두고, 운전자가 맞춘 값이 기록에 쌓이면 그 값을 추천한다
 * (bodyfit-learning.ts 의 learnRemembered).
 */
export const LEARNED_ONLY_AXES = ["lumbar", "headrestAngle"] as const;

export type LearnedOnlyAxis = (typeof LEARNED_ONLY_AXES)[number];

/** 체형으로 기본 추천을 계산하는 축 */
export type BaselineAxis = Exclude<SeatAxis, LearnedOnlyAxis>;

export const isLearnedOnlyAxis = (axis: SeatAxis): axis is LearnedOnlyAxis =>
  (LEARNED_ONLY_AXES as readonly SeatAxis[]).includes(axis);

const isBaselineAxis = (axis: SeatAxis): axis is BaselineAxis =>
  !isLearnedOnlyAxis(axis);

export const BASELINE_AXES: readonly BaselineAxis[] =
  SEAT_AXES.filter(isBaselineAxis);

// 앉은키를 모를 때 쓰는 대략적인 성인 평균 비율 (앉은키 ≈ 키의 53%). 카메라 추정(bodyfit-body-scan.ts)도 이 값을 기준으로 삼는다.
export const SITTING_HEIGHT_RATIO = 0.53;
const STATURE_RANGE = { min: 150, max: 195 };
const SITTING_RANGE = { min: 78, max: 100 };
// 다리 길이(키 − 앉은키). 키 150~195cm 에 평균 비율(47%)을 곱한 범위다.
const LEG_RANGE = { min: 70, max: 92 };

const normalize = (value: number, range: { min: number; max: number }) =>
  clamp((value - range.min) / (range.max - range.min), 0, 1);

/**
 * 체형만으로 계산한 첫 추천 자세. 운전 자세 일반 원칙(키가 클수록 뒤로, 상체가 길수록 낮게)을 단순화한 초깃값이며,
 * 정확도는 개인 학습 보정(offsets)으로 맞춘다. 계수를 바꾸면 bodyfit-recommend.test.ts 도 함께 고친다.
 *
 * 허리 지지대·헤드레스트 각도는 넣지 않는다 (LEARNED_ONLY_AXES).
 */
export function recommendBaseline(
  profile: BodyProfile,
): Record<BaselineAxis, number> {
  const stature = normalize(profile.heightCm, STATURE_RANGE);
  const sittingCm =
    profile.sittingHeightCm ?? profile.heightCm * SITTING_HEIGHT_RATIO;
  const sitting = normalize(sittingCm, SITTING_RANGE);
  const leg = normalize(profile.heightCm - sittingCm, LEG_RANGE);
  // 체중이 많이 실리면 좌판이 더 눌려 앉은 높이가 낮아지므로 조금 높인다.
  const bmi = profile.weightKg / (profile.heightCm / 100) ** 2;
  const cushion = clamp((bmi - 22) * 0.01, -0.05, 0.08);

  return {
    foreAft: clamp(0.85 - 0.6 * stature, 0, 1),
    height: clamp(0.75 - 0.5 * sitting + cushion, 0, 1),
    backrest: clamp(0.72 - 0.08 * stature, 0, 1),
    tilt: clamp(0.45 + 0.1 * stature, 0, 1),
    // 좌판은 허벅지를 받치되 무릎 뒤에 손가락 두세 개가 들어갈 틈을 남긴다. 허벅지 길이는 다리 길이를 따라가므로
    // 다리가 길수록 길게 뺀다. 양 끝(가장 짧게·길게)은 학습 보정이 움직일 자리로 남긴다.
    depth: clamp(0.2 + 0.6 * leg, 0, 1),
    // 헤드레스트 가운데가 귀·눈높이에 오게 한다. 헤드레스트는 시트와 함께 움직이므로 상체 길이(앉은키)만 따른다.
    headrestHeight: clamp(0.1 + 0.8 * sitting, 0, 1),
    // 어깨띠가 목이 아니라 어깨 가운데를 지나게 한다. 고정 장치는 차체(B 필러)에 있고,
    // 상체가 긴 사람은 시트 높이를 낮게 추천받아 어깨 높이 차이가 줄어들므로 헤드레스트보다 완만하게 올린다.
    beltHeight: clamp(0.2 + 0.6 * sitting, 0, 1),
  };
}

/**
 * 기본 추천에 개인 보정을 더한 최종 추천.
 * 기본 추천이 없는 축은 기억한 값(remembered)이 있을 때만 넣는다. 없으면 추천하지 않아 지금 위치를 그대로 둔다.
 */
export function recommendSeat(
  profile: BodyProfile,
  offsets: SeatRatios,
  remembered: SeatRatios = {},
): SeatRatios {
  const baseline = recommendBaseline(profile);
  const recommended: SeatRatios = {};
  for (const axis of SEAT_AXES) {
    if (isLearnedOnlyAxis(axis)) {
      const kept = remembered[axis];
      if (kept !== undefined) recommended[axis] = clamp(kept, 0, 1);
      continue;
    }
    recommended[axis] = clamp(baseline[axis] + (offsets[axis] ?? 0), 0, 1);
  }
  return recommended;
}
