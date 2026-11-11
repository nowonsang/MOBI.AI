import { SEAT_AXES } from "@/shared/pleos/pleos.types";

import { GUIDE_TOLERANCE } from "./bodyfit-guide";
import { clamp } from "./bodyfit-seat";
import type { SeatAdjustment, SeatAxis, SeatRatios } from "./bodyfit.types";

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
  const recent = [...history].sort((a, b) => b.at - a.at).slice(0, MAX_RECORDS);
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

// 축 방향은 SeatRatios 를 따른다 (1 = 가장 앞·높게·세움·좌판 앞쪽 높게).
const ADJUSTED_PHRASE: Record<
  SeatAxis,
  { increase: string; decrease: string }
> = {
  foreAft: {
    increase: "시트를 더 앞으로 당기셔서",
    decrease: "시트를 더 뒤로 미셔서",
  },
  height: { increase: "시트를 더 높이셔서", decrease: "시트를 더 낮추셔서" },
  backrest: {
    increase: "등받이를 더 세우셔서",
    decrease: "등받이를 더 눕히셔서",
  },
  tilt: {
    increase: "좌판 앞쪽을 더 올리셔서",
    decrease: "좌판 앞쪽을 더 내리셔서",
  },
};

/**
 * 추천이 체형만으로 계산한 자세와 왜 다른지 한 문장으로 알려 준다 (C-4).
 * 가장 크게 보정한 축 하나만 말한다 (차량 화면에서 한눈에 읽히게).
 * 보정이 가이드 허용 오차보다 작으면 추천이 달라져 보이지 않으므로 null.
 */
export function explainOffsets(
  history: readonly SeatAdjustment[],
): string | null {
  const offsets = learnOffsets(history);
  let strongest: { axis: SeatAxis; offset: number } | null = null;
  for (const axis of SEAT_AXES) {
    const offset = offsets[axis];
    if (offset === undefined || Math.abs(offset) < GUIDE_TOLERANCE) continue;
    if (strongest === null || Math.abs(offset) > Math.abs(strongest.offset)) {
      strongest = { axis, offset };
    }
  }
  if (strongest === null) return null;

  const when = history.length === 1 ? "지난번에" : "그동안";
  const phrase =
    ADJUSTED_PHRASE[strongest.axis][
      strongest.offset > 0 ? "increase" : "decrease"
    ];
  return `${when} ${phrase} 반영했어요`;
}
