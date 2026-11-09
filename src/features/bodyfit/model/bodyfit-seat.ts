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

export type SeatTarget = { axis: SeatAxis; target: number };

/** 비율 → 차량 원시 목표값. 움직일 수 있는 축만 돌려준다. 앞뒤 → 높이 → 등받이 → 기울기 순서로 움직인다. */
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
