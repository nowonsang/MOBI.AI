import { SEAT_AXES } from "@/shared/pleos/pleos.types";

import { clamp } from "./bodyfit-seat";
import type { SeatAxis, SeatRatios } from "./bodyfit.types";

/**
 * 가이드 조절 시연 모드.
 * Pleos 에뮬레이터는 시트 위치를 늘 0 으로 돌려줘 운전자가 버튼을 눌러도 안내가 움직이지 않는다.
 * 시연에서는 화면의 버튼이 시트 버튼 역할을 하고, 이 모의 위치로 같은 안내 로직(guideSeat)을 돌린다.
 * 모의 값은 학습 기록에 남기지 않는다.
 */

/** 버튼 한 번에 움직이는 양 (범위의 비율). 허용 오차(3%)보다 커서 지나치는 장면도 보여 줄 수 있다. */
export const DEMO_STEP = 0.04;

// 목표에서 이만큼 떨어진 곳에서 시작한다. 축마다 방향과 거리를 달리해 "더 / 조금 더 / 지나쳤어요" 가 모두 나오게 한다.
const START_OFFSET: Record<SeatAxis, number> = {
  foreAft: -0.2,
  height: 0.12,
  backrest: -0.08,
  tilt: 0.06,
  depth: -0.1,
  headrestHeight: -0.16,
  beltHeight: 0.08,
};

/** 목표 자세에서 조금씩 어긋난 시작 자세. 범위 끝에 막히면 반대 방향으로 어긋나게 한다. */
export function startDemoSeat(target: SeatRatios): SeatRatios {
  const start: SeatRatios = {};
  for (const axis of SEAT_AXES) {
    const goal = target[axis];
    if (goal === undefined) continue;
    const offset = START_OFFSET[axis];
    const shifted = goal + offset;
    start[axis] =
      shifted < 0 || shifted > 1 ? clamp(goal - offset, 0, 1) : shifted;
  }
  return start;
}

/** 화면의 시트 버튼을 한 번 누른 결과. 범위(0~1) 밖으로 나가지 않는다. */
export function pressDemoSeat(
  seat: SeatRatios,
  axis: SeatAxis,
  direction: "increase" | "decrease",
  step: number = DEMO_STEP,
): SeatRatios {
  const now = seat[axis];
  if (now === undefined) return seat;
  const next = clamp(now + (direction === "increase" ? step : -step), 0, 1);
  // 부동소수 오차로 0.3999… 처럼 보이지 않게 소수 셋째 자리에서 맞춘다.
  return { ...seat, [axis]: Math.round(next * 1000) / 1000 };
}
