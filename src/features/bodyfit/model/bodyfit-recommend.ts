import { SEAT_AXES } from "@/shared/pleos/pleos.types";

import { clamp } from "./bodyfit-seat";
import type { BodyProfile, SeatRatios } from "./bodyfit.types";

// 앉은키를 모를 때 쓰는 대략적인 성인 평균 비율 (앉은키 ≈ 키의 53%)
const SITTING_HEIGHT_RATIO = 0.53;
const STATURE_RANGE = { min: 150, max: 195 };
const SITTING_RANGE = { min: 78, max: 100 };

const normalize = (value: number, range: { min: number; max: number }) =>
  clamp((value - range.min) / (range.max - range.min), 0, 1);

/**
 * 체형만으로 계산한 첫 추천 자세. 운전 자세 일반 원칙(키가 클수록 뒤로, 상체가 길수록 낮게)을 단순화한 초깃값이며,
 * 정확도는 개인 학습 보정(offsets)으로 맞춘다. 계수를 바꾸면 bodyfit-recommend.test.ts 도 함께 고친다.
 */
export function recommendBaseline(profile: BodyProfile): SeatRatios {
  const stature = normalize(profile.heightCm, STATURE_RANGE);
  const sitting = normalize(
    profile.sittingHeightCm ?? profile.heightCm * SITTING_HEIGHT_RATIO,
    SITTING_RANGE,
  );
  // 체중이 많이 실리면 좌판이 더 눌려 앉은 높이가 낮아지므로 조금 높인다.
  const bmi = profile.weightKg / (profile.heightCm / 100) ** 2;
  const cushion = clamp((bmi - 22) * 0.01, -0.05, 0.08);

  return {
    foreAft: clamp(0.85 - 0.6 * stature, 0, 1),
    height: clamp(0.75 - 0.5 * sitting + cushion, 0, 1),
    backrest: clamp(0.72 - 0.08 * stature, 0, 1),
    tilt: clamp(0.45 + 0.1 * stature, 0, 1),
  };
}

/** 기본 추천에 개인 보정을 더한 최종 추천 */
export function recommendSeat(
  profile: BodyProfile,
  offsets: SeatRatios,
): SeatRatios {
  const baseline = recommendBaseline(profile);
  const recommended: SeatRatios = {};
  for (const axis of SEAT_AXES) {
    const base = baseline[axis];
    if (base === undefined) continue;
    recommended[axis] = clamp(base + (offsets[axis] ?? 0), 0, 1);
  }
  return recommended;
}
