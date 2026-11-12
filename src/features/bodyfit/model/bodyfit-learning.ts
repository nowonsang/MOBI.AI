import { SEAT_AXES } from "@/shared/pleos/pleos.types";

import { GUIDE_TOLERANCE } from "./bodyfit-guide";
import { clamp } from "./bodyfit-seat";
import type {
  DriveContext,
  SeatAdjustment,
  SeatAxis,
  SeatRatios,
} from "./bodyfit.types";

const MAX_RECORDS = 10;
// 최근 기록일수록 크게 반영한다 (한 단계 오래될 때마다 가중치 × 0.7).
const DECAY = 0.7;
// 한 번의 이상한 기록이 추천을 크게 흔들지 않게 보정 폭을 제한한다.
const MAX_OFFSET = 0.3;
/**
 * 고른 상황의 기록이 이만큼 모이면 그 기록만으로 보정한다 (C-5).
 * 그 전에는 (그 상황의 기록 수 ÷ 이 값)만큼만 반영하고 나머지는 전체 기록으로 채운다.
 */
export const CONTEXT_FULL_RECORDS = 3;

/**
 * 운전자가 실제로 받아들인 자세(final)와 체형 기반 추천(baseline)의 차이를 학습해 축별 보정값을 만든다.
 * 수동 조절·음성 피드백·주행 시작 자세가 모두 같은 방식으로 반영된다.
 */
function averageOffsets(history: readonly SeatAdjustment[]): SeatRatios {
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

const recordsIn = (
  history: readonly SeatAdjustment[],
  context: DriveContext,
): SeatAdjustment[] => history.filter((record) => record.context === context);

/**
 * 고른 상황의 추천에 쓸 축별 보정값 (C-2, C-5).
 * 그 상황의 기록이 CONTEXT_FULL_RECORDS 건 이상이면 그 기록만으로 보정하고,
 * 적으면 전체 기록의 보정값과 섞고, 없으면 전체 기록으로 보정한다.
 * 상황을 고른 적이 없는 운전자는 모든 기록이 평소라 전체 기록으로 보정한 것과 같다.
 */
export function learnOffsets(
  history: readonly SeatAdjustment[],
  context: DriveContext,
): SeatRatios {
  const overall = averageOffsets(history);
  const own = recordsIn(history, context);
  const ownOffsets = averageOffsets(own);
  const weight = Math.min(own.length / CONTEXT_FULL_RECORDS, 1);
  const offsets: SeatRatios = {};

  for (const axis of SEAT_AXES) {
    const all = overall[axis];
    if (all === undefined) continue;
    // 그 상황의 기록에 없는 축은 전체 기록의 보정값을 그대로 쓴다.
    const mine = ownOffsets[axis] ?? all;
    offsets[axis] = all + (mine - all) * weight;
  }
  return offsets;
}

export type LearningBasis = {
  /** own: 그 상황의 기록만, mixed: 그 상황의 기록과 전체 기록을 섞음, all: 그 상황의 기록이 없어 전체 기록만 */
  kind: "own" | "mixed" | "all";
  /** 그 상황의 기록 수 */
  contextCount: number;
  /** 추천에 반영한 기록 수 */
  usedCount: number;
};

/** 고른 상황의 추천이 어떤 기록을 바탕으로 했는지. 화면이 운전자에게 알려 주는 데 쓴다. */
export function learningBasis(
  history: readonly SeatAdjustment[],
  context: DriveContext,
): LearningBasis {
  const contextCount = recordsIn(history, context).length;
  if (contextCount === 0) {
    return { kind: "all", contextCount, usedCount: history.length };
  }
  // 기록이 모두 그 상황의 것이면 섞을 다른 기록이 없다.
  if (contextCount >= CONTEXT_FULL_RECORDS || contextCount === history.length) {
    return { kind: "own", contextCount, usedCount: contextCount };
  }
  return { kind: "mixed", contextCount, usedCount: history.length };
}

// 평소는 상황을 고르지 않은 것이라 상황을 이유로 들지 않는다 ("지난번에", "그동안"으로 말한다).
const CONTEXT_WHEN: Record<DriveContext, string | null> = {
  usual: null,
  commute: "출퇴근할 때는",
  long: "장거리에서는",
  city: "시내에서는",
};

// 축 방향은 SeatRatios 를 따른다 (1 = 가장 앞·높게·세움·좌판 앞쪽 높게·좌판 길게).
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
  depth: { increase: "좌판을 더 늘리셔서", decrease: "좌판을 더 줄이셔서" },
  headrestHeight: {
    increase: "헤드레스트를 더 높이셔서",
    decrease: "헤드레스트를 더 낮추셔서",
  },
  beltHeight: {
    increase: "안전벨트를 더 높이셔서",
    decrease: "안전벨트를 더 낮추셔서",
  },
};

/**
 * 추천이 체형만으로 계산한 자세와 왜 다른지 한 문장으로 알려 준다 (C-4).
 * 가장 크게 보정한 축 하나만 말한다 (차량 화면에서 한눈에 읽히게).
 * 보정이 가이드 허용 오차보다 작으면 추천이 달라져 보이지 않으므로 null.
 * 고른 상황의 기록이 그 보정과 같은 쪽을 가리키면 상황을 이유로 든다 ("장거리에서는 …", C-5).
 */
export function explainOffsets(
  history: readonly SeatAdjustment[],
  context: DriveContext,
): string | null {
  const offsets = learnOffsets(history, context);
  let strongest: { axis: SeatAxis; offset: number } | null = null;
  for (const axis of SEAT_AXES) {
    const offset = offsets[axis];
    if (offset === undefined || Math.abs(offset) < GUIDE_TOLERANCE) continue;
    if (strongest === null || Math.abs(offset) > Math.abs(strongest.offset)) {
      strongest = { axis, offset };
    }
  }
  if (strongest === null) return null;

  // 전체 기록에서 온 보정을 상황 탓으로 말하지 않는다: 그 상황의 기록만으로도 같은 쪽으로 눈에 띄게 어긋날 때만 상황을 말한다.
  const own = averageOffsets(recordsIn(history, context))[strongest.axis];
  const fromContext =
    own !== undefined &&
    own * strongest.offset > 0 &&
    Math.abs(own) >= GUIDE_TOLERANCE;
  const when =
    (fromContext ? CONTEXT_WHEN[context] : null) ??
    (history.length === 1 ? "지난번에" : "그동안");
  const phrase =
    ADJUSTED_PHRASE[strongest.axis][
      strongest.offset > 0 ? "increase" : "decrease"
    ];
  return `${when} ${phrase} 반영했어요`;
}

/**
 * 새 기록을 더하고, 운전자·상황마다 최근 max 건만 남긴다.
 * 운전자별 전체 개수로 자르면 자주 고르는 상황(출퇴근)의 기록이 가끔 고르는 상황(장거리)의 기록을 밀어낸다.
 */
export function appendSeatAdjustment(
  all: readonly SeatAdjustment[],
  record: SeatAdjustment,
  max: number,
): SeatAdjustment[] {
  const sameBucket = (item: SeatAdjustment) =>
    item.profileId === record.profileId && item.context === record.context;
  return [
    ...all.filter((item) => !sameBucket(item)),
    ...all.filter(sameBucket).concat(record).slice(-max),
  ];
}
