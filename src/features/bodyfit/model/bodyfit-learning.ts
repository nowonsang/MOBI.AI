import { SEAT_AXES } from "@/shared/pleos/pleos.types";

import { clamp } from "./bodyfit-seat";
import type { SeatAdjustment, SeatRatios } from "./bodyfit.types";

const MAX_RECORDS = 10;
// 최근 기록일수록 크게 반영한다 (한 단계 오래될 때마다 가중치 × 0.7).
const DECAY = 0.7;
// 한 번의 이상한 기록이 추천을 크게 흔들지 않게 보정 폭을 제한한다.
const MAX_OFFSET = 0.3;

/**
 * 운전자가 실제로 받아들인 자세(final)와 체형 기반 추천(baseline)의 차이를 학습해 축별 보정값을 만든다.
 * 수동 조절·음성 피드백·주행 시작 자세가 모두 같은 방식으로 반영된다.
 */
export function learnOffsets(history: readonly SeatAdjustment[]): SeatRatios {
  const recent = [...history]
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_RECORDS);
  const offsets: SeatRatios = {};

  for (const axis of SEAT_AXES) {
    let weightedSum = 0;
    let totalWeight = 0;
    recent.forEach((record, index) => {
      const baseline = record.baseline[axis];
      const final = record.final[axis];
      if (baseline === undefined || final === undefined) return;
      const weight = DECAY ** index;
      weightedSum += (final - baseline) * weight;
      totalWeight += weight;
    });
    if (totalWeight > 0) {
      offsets[axis] = clamp(weightedSum / totalWeight, -MAX_OFFSET, MAX_OFFSET);
    }
  }
  return offsets;
}
