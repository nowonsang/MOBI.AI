import { SEAT_AXES, type PleosErrorCode } from "@/shared/pleos/pleos.types";

import { driveDemoSeat, startDemoSeat } from "./bodyfit-demo-seat";
import type { SeatAxis, SeatRatios } from "./bodyfit.types";

/**
 * 자동 조절(B-4·B-7) 한 번의 진행 상태.
 * 화면은 이 상태만 보고 어느 축이 움직이는 중이고 어느 축이 끝났는지 그린다.
 * 실제 이동(네이티브가 움직이고 진행만 알려 준다)과 시연 모드(모의 위치가 움직인다)가 같은 상태를 쓴다.
 */

/** 움직일 한 축. 위치는 비율(0~1)이다. */
export type AutoAdjustStep = { axis: SeatAxis; start: number; target: number };

/** done: 모든 축을 맞춤, stopped: 운전자가 멈춤, failed: 차량이 끝까지 움직이지 못함 */
export type AutoAdjustOutcome = "done" | "stopped" | "failed";

export type AutoAdjustRun = {
  /** 시연 모드: 실제 시트는 움직이지 않고 모의 위치만 움직인다 */
  demo: boolean;
  /** 움직일 축과 순서 (앞뒤 → 높이 → 등받이 → 기울기). 차량에서 시트 상태를 읽기 전에는 비어 있다 */
  steps: AutoAdjustStep[];
  /** 끝난 축의 수. steps[completed] 가 지금 움직이는 축이다 */
  completed: number;
  /** 운전자가 멈추기를 눌렀고 차량이 멈추기를 기다리는 중 */
  stopping: boolean;
  /** null 이면 움직이는 중 */
  outcome: AutoAdjustOutcome | null;
  /** 실패한 이유 (outcome 이 failed 일 때만) */
  errorCode: PleosErrorCode | null;
};

export type AutoAdjustState = {
  /** 시연 모드 스위치. 켜 두면 자동 조절이 모의 위치로만 움직인다 */
  demo: boolean;
  /** 시연 모드의 모의 시트 위치. 시연으로 한 번 움직인 뒤부터 있다. 학습 기록에 남기지 않는다 */
  demoSeat: SeatRatios | null;
  run: AutoAdjustRun | null;
};

export type AutoAdjustEvent =
  | { type: "demoToggled" }
  /** 실제 이동을 시작했다. 움직일 축은 차량 상태를 읽은 뒤 progressed 로 온다 */
  | { type: "started" }
  /** 시연을 시작했다. from 은 화면에 보이던 지금 자세. 그 축들만 움직인다 (없으면 목표에서 어긋난 모의 자세에서 시작한다) */
  | { type: "demoStarted"; target: SeatRatios; from: SeatRatios | null }
  /** 실제 이동: 움직일 축이 정해졌거나 축 하나가 끝났다 */
  | { type: "progressed"; steps: AutoAdjustStep[]; completed: number }
  /** 시연: 한 간격이 지났다. parked 가 거짓이면 실제와 같이 바로 멈춘다 (S-1) */
  | { type: "ticked"; parked: boolean }
  | { type: "stopRequested" }
  /** 실제 이동이 끝났다 (failed: 차량 호출이 실패로 끝남) */
  | { type: "settled"; failed: boolean; errorCode: PleosErrorCode | null }
  | { type: "dismissed" };

export const initialAutoAdjust: AutoAdjustState = {
  demo: false,
  demoSeat: null,
  run: null,
};

/**
 * 움직일 축을 순서대로 정리한다. axes 에 없거나 목표가 없는 축은 뺀다.
 * 지금 위치를 모르는 축은 목표에 있는 것으로 본다 (움직일 거리를 알 수 없다).
 */
export function planAutoAdjust(
  current: SeatRatios,
  target: SeatRatios,
  axes: readonly SeatAxis[] = SEAT_AXES,
): AutoAdjustStep[] {
  const steps: AutoAdjustStep[] = [];
  for (const axis of SEAT_AXES) {
    const goal = target[axis];
    if (goal === undefined || !axes.includes(axis)) continue;
    steps.push({ axis, start: current[axis] ?? goal, target: goal });
  }
  return steps;
}

const isMoving = (run: AutoAdjustRun | null): run is AutoAdjustRun =>
  run !== null && run.outcome === null;

const newRun = (demo: boolean, steps: AutoAdjustStep[]): AutoAdjustRun => ({
  demo,
  steps,
  completed: 0,
  stopping: false,
  outcome: null,
  errorCode: null,
});

const finish = (
  state: AutoAdjustState,
  run: AutoAdjustRun,
  outcome: AutoAdjustOutcome,
  errorCode: PleosErrorCode | null = null,
): AutoAdjustState => ({
  ...state,
  run: { ...run, stopping: false, outcome, errorCode },
});

export function autoAdjustReducer(
  state: AutoAdjustState,
  event: AutoAdjustEvent,
): AutoAdjustState {
  const { run } = state;
  switch (event.type) {
    case "demoToggled":
      // 움직이는 중에는 바꾸지 않는다. 바꾸면 모의 위치를 버려 실제 값과 섞이지 않게 한다.
      if (isMoving(run)) return state;
      return { demo: !state.demo, demoSeat: null, run: null };

    case "started":
      if (isMoving(run)) return state;
      return { ...state, run: newRun(false, []) };

    case "demoStarted": {
      if (isMoving(run)) return state;
      // 차량이 위치를 알려 주는 축만 움직인다 (화면의 "지금 → 추천"과 같은 축). 하나도 모르면 모의 자세에서 시작한다.
      const known = SEAT_AXES.filter(
        (axis) => event.from?.[axis] !== undefined,
      );
      const steps =
        event.from && known.length > 0
          ? planAutoAdjust(event.from, event.target, known)
          : planAutoAdjust(startDemoSeat(event.target), event.target);
      const demoSeat: SeatRatios = {};
      for (const step of steps) demoSeat[step.axis] = step.start;
      return { ...state, demoSeat, run: newRun(true, steps) };
    }

    case "progressed":
      if (!isMoving(run) || run.demo) return state;
      return {
        ...state,
        run: { ...run, steps: event.steps, completed: event.completed },
      };

    case "ticked": {
      if (!isMoving(run) || !run.demo) return state;
      if (!event.parked) return finish(state, run, "failed", "ERR_NOT_PARKED");
      const step = run.steps[run.completed];
      if (!step) return finish(state, run, "done");
      const demoSeat = driveDemoSeat(
        state.demoSeat ?? {},
        step.axis,
        step.target,
      );
      const arrived =
        Math.abs((demoSeat[step.axis] ?? step.target) - step.target) < 1e-6;
      const completed = arrived ? run.completed + 1 : run.completed;
      const moved = { ...state, demoSeat };
      return completed === run.steps.length
        ? finish(moved, { ...run, completed }, "done")
        : { ...moved, run: { ...run, completed } };
    }

    case "stopRequested":
      if (!isMoving(run)) return state;
      // 시연은 그 자리에서 멈춘다. 실제 이동은 차량이 멈췄다고 알려 줄 때(settled)까지 기다린다.
      return run.demo
        ? finish(state, run, "stopped")
        : { ...state, run: { ...run, stopping: true } };

    case "settled": {
      if (!isMoving(run) || run.demo) return state;
      const all = run.steps.length > 0 && run.completed >= run.steps.length;
      if (!event.failed) return finish(state, run, all ? "done" : "stopped");
      // 멈추기를 누르면 차량 호출이 취소로 끝난다. 그 실패는 운전자가 멈춘 것이다.
      return run.stopping
        ? finish(state, run, "stopped")
        : finish(state, run, "failed", event.errorCode);
    }

    case "dismissed":
      // 움직이는 중에는 닫지 않는다 (멈추기 버튼이 사라지면 안 된다).
      return isMoving(run) ? state : { ...state, run: null };
  }
}

/** waiting: 차례를 기다림, moving: 움직이는 중, done: 맞춤, stopped: 여기서 멈춤, failed: 여기서 실패 */
export type AutoAdjustAxisStatus =
  "waiting" | "moving" | "done" | "stopped" | "failed";

export type AutoAdjustAxis = AutoAdjustStep & {
  /** 지금 위치. 차량이 알려 주지 않으면 끝난 축은 목표, 나머지는 시작 위치로 본다 */
  current: number;
  status: AutoAdjustAxisStatus;
  /** 목표로 가려면 비율을 키우는지 줄이는지. 이미 목표에 있으면 null */
  direction: "increase" | "decrease" | null;
};

/** 축별 진행 상황. current 는 차량(또는 시연의 모의 시트)에서 읽은 지금 자세다. */
export function viewAutoAdjust(
  run: AutoAdjustRun,
  current: SeatRatios | null,
): AutoAdjustAxis[] {
  return run.steps.map((step, index) => {
    const status: AutoAdjustAxisStatus =
      index < run.completed || run.outcome === "done"
        ? "done"
        : index > run.completed
          ? "waiting"
          : (run.outcome ?? "moving");
    return {
      ...step,
      current:
        current?.[step.axis] ?? (status === "done" ? step.target : step.start),
      status,
      direction:
        step.target > step.start
          ? "increase"
          : step.target < step.start
            ? "decrease"
            : null,
    };
  });
}

/** 맞춘 축의 수 */
export function countAdjusted(run: AutoAdjustRun): number {
  return run.outcome === "done" ? run.steps.length : run.completed;
}
