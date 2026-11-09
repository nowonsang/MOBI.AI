import { SEAT_AXES } from "@/shared/pleos/pleos.types";

import type { SeatAxis, SeatRatios } from "./bodyfit.types";

/** 이만큼(범위의 3%) 안이면 맞춘 것으로 본다. 손으로 버튼을 눌러 맞추므로 자동 조절(1%)보다 넉넉하게 둔다. */
export const GUIDE_TOLERANCE = 0.03;

/** 이보다 멀면 "조금 더" 대신 "더" 라고 안내한다. */
const FAR_GAP = 0.15;

/** ok: 맞춤, more: 아직 덜 갔음, overshot: 목표를 지나쳤음 */
export type AxisGuideStatus = "ok" | "more" | "overshot";

export type AxisGuide = {
  axis: SeatAxis;
  current: number;
  target: number;
  status: AxisGuideStatus;
  /** 목표로 가려면 비율을 키워야 하는지 줄여야 하는지. ok 면 null */
  direction: "increase" | "decrease" | null;
  far: boolean;
};

export type SeatGuide = {
  axes: AxisGuide[];
  /** 지금 맞출 축. 앞뒤 → 높이 → 등받이 → 기울기 순서로 하나씩 안내한다. 다 맞췄으면 null */
  focus: SeatAxis | null;
  done: boolean;
};

type Side = "below" | "above" | "inside";

const sideOf = (value: number, target: number, tolerance: number): Side =>
  value < target - tolerance
    ? "below"
    : value > target + tolerance
      ? "above"
      : "inside";

/**
 * 현재 자세와 목표 자세를 비교해 축별 안내를 만든다.
 * start(안내를 시작할 때의 자세)와 반대편으로 넘어가 있으면 "지나쳤어요" 로 안내한다.
 * 현재 값이나 목표가 없는 축은 건너뛴다.
 */
export function guideSeat(
  current: SeatRatios,
  target: SeatRatios,
  start: SeatRatios | null = null,
  tolerance: number = GUIDE_TOLERANCE,
): SeatGuide {
  const axes: AxisGuide[] = [];
  for (const axis of SEAT_AXES) {
    const now = current[axis];
    const goal = target[axis];
    if (now === undefined || goal === undefined) continue;

    const side = sideOf(now, goal, tolerance);
    const began = start?.[axis];
    const beganSide =
      began === undefined ? "inside" : sideOf(began, goal, tolerance);
    const status: AxisGuideStatus =
      side === "inside"
        ? "ok"
        : beganSide !== "inside" && beganSide !== side
          ? "overshot"
          : "more";

    axes.push({
      axis,
      current: now,
      target: goal,
      status,
      direction:
        side === "below" ? "increase" : side === "above" ? "decrease" : null,
      far: Math.abs(goal - now) > FAR_GAP,
    });
  }

  const focus = axes.find((guide) => guide.status !== "ok")?.axis ?? null;
  return { axes, focus, done: axes.length > 0 && focus === null };
}
