import { SEAT_AXES, type DriverSeatState } from "@/shared/pleos/pleos.types";

import type { SeatAxis, SeatNudge, SeatRatios } from "./bodyfit.types";

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** 차량 원시 값 → 비율. 범위가 0 인 축은 뺀다. */
export function toSeatRatios(state: DriverSeatState): SeatRatios {
  const ratios: SeatRatios = {};
  for (const axis of SEAT_AXES) {
    const axisState = state[axis];
    if (!axisState || axisState.max === axisState.min) continue;
    ratios[axis] = clamp(
      (axisState.value - axisState.min) / (axisState.max - axisState.min),
      0,
      1,
    );
  }
  return ratios;
}

/** 빈 상태가 오면 이 횟수까지만 다시 읽는다. */
export const SEAT_REREAD_LIMIT = 5;

/**
 * 시트 상태를 조금 뒤에 다시 읽어야 하는지.
 * 앱을 켠 직후에는 Pleos 차량 서비스 연결이 끝나기 전이라 축을 하나도 읽지 못한 빈 상태가 온다 (에러가 아니다).
 * 지원하는 축이 정말 없는 차량에서 끝없이 읽지 않도록 횟수를 제한한다.
 */
export function shouldRereadSeat(
  state: DriverSeatState | undefined,
  reads: number,
): boolean {
  if (state === undefined || reads >= SEAT_REREAD_LIMIT) return false;
  return SEAT_AXES.every((axis) => state[axis] === undefined);
}

export type SeatTarget = { axis: SeatAxis; target: number };

/**
 * 비율 → 차량 원시 목표값. 움직일 수 있는 축만 돌려준다.
 * 앞뒤 → 높이 → 등받이 → 기울기 → 좌판 길이 → 헤드레스트 → 안전벨트 → 허리 지지대 → 헤드레스트 각도 순서로 움직인다.
 */
export function toSeatTargets(
  ratios: SeatRatios,
  state: DriverSeatState,
): SeatTarget[] {
  const targets: SeatTarget[] = [];
  for (const axis of SEAT_AXES) {
    const axisState = state[axis];
    const ratio = ratios[axis];
    if (!axisState?.movable || ratio === undefined) continue;
    targets.push({
      axis,
      target: Math.round(
        axisState.min + clamp(ratio, 0, 1) * (axisState.max - axisState.min),
      ),
    });
  }
  return targets;
}

const NUDGE_SIZE: Record<SeatNudge["amount"], number> = {
  small: 0.04,
  medium: 0.08,
};

/** 현재 자세에 음성 피드백의 조절량을 더한다. */
export function applyNudges(
  current: SeatRatios,
  nudges: readonly SeatNudge[],
): SeatRatios {
  const next: SeatRatios = { ...current };
  for (const { axis, direction, amount } of nudges) {
    const base = next[axis];
    if (base === undefined) continue;
    const delta = NUDGE_SIZE[amount] * (direction === "increase" ? 1 : -1);
    next[axis] = clamp(base + delta, 0, 1);
  }
  return next;
}

// 앞뒤·높이·등받이·좌판 기울기. 운전자가 늘 바꾸는 축이라 넷이 한꺼번에 가장 낮은 끝(0)에 있는 일은 실제로 거의 없다.
const CORE_AXES = ["foreAft", "height", "backrest", "tilt"] as const;

/**
 * 시트 위치를 믿을 수 없는지. 주요 축이 둘 이상 읽혔는데 모두 정확히 0 이면 센서 값이 오지 않은 것으로 본다.
 * Pleos Connect 에뮬레이터는 시트 위치를 늘 0 으로 준다 (features.md "에뮬레이터 v2.1.0 의 시트").
 * 이 값을 "운전자가 받아들인 자세"로 학습하면 추천이 가장 낮은 끝으로 끌려간다.
 */
export function isSeatPositionUnknown(current: SeatRatios): boolean {
  const read = CORE_AXES.filter((axis) => current[axis] !== undefined);
  return read.length >= 2 && read.every((axis) => current[axis] === 0);
}

/**
 * 학습 기록으로 남길 자세(final). 지금 자세에 고른 방향(nudges)을 더한다.
 * 지금 자세를 믿을 수 없으면: 고른 방향이 없으면 남기지 않고(null), 있으면 체형 기본 추천에 그 방향만 더한다
 * (기본 추천과의 차이가 곧 고른 방향이 되어, 위치 값 없이도 "등받이를 세워 달라"는 뜻만 학습된다).
 */
export function seatAdjustmentFinal(
  current: SeatRatios,
  baseline: SeatRatios,
  nudges: readonly SeatNudge[],
): SeatRatios | null {
  if (!isSeatPositionUnknown(current)) return applyNudges(current, nudges);
  if (nudges.length === 0) return null;
  return applyNudges(baseline, nudges);
}
