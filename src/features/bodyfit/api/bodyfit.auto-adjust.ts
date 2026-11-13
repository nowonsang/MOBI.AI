import { useIsMutating } from "@tanstack/react-query";
import { useEffect, useReducer, useRef } from "react";

import { canUseDemoMode } from "@/shared/config/app-variant";
import { isEmulator } from "@/shared/config/emulator";
import { pleosErrorCode } from "@/shared/pleos/pleos";

import {
  autoAdjustReducer,
  initialAutoAdjust,
} from "../model/bodyfit-auto-adjust";
import { DEMO_MOVE_TICK_MS } from "../model/bodyfit-demo-seat";
import type { SeatRatios } from "../model/bodyfit.types";
import { useMoveSeat, useStopSeat } from "./bodyfit.mutations";
import { bodyfitKeys } from "./bodyfit.queries";

// 에뮬레이터는 시트 위치가 늘 0 이라 자동 조절 흐름을 모의 위치로만 보여 줄 수 있다.
// 실제 차량에서는 운전자가 쓸 일이 없어 화면에 내놓지 않는다 (가이드 조절 시연도 같은 기준).
export const canDemoSeat = canUseDemoMode && isEmulator;

// 멈추기를 눌렀는데도 이동이 끝나지 않으면 이 간격으로 STOP 을 다시 보낸다.
const STOP_RETRY_MS = 500;

/**
 * 자동 조절(B-4·B-7) 한 번의 흐름: 시작 → 축별 진행 → 멈추기·완료·실패.
 * 실제 차량에서는 네이티브 이동(useMoveSeat)을 그대로 쓰고 진행만 받아 적는다. 기어 P 확인과 STOP 은 네이티브가 한다.
 * 시연 모드(contest 빌드)에서는 차량에 이동 명령을 보내지 않고 모의 위치만 움직인다. 학습 기록에는 어느 쪽도 남기지 않는다.
 * 운전자 확인(S-2)은 화면이 받는다: start 는 확인 창의 버튼에서만 부른다.
 */
export function useAutoAdjust({ parked }: { parked: boolean }) {
  const [state, dispatch] = useReducer(autoAdjustReducer, initialAutoAdjust);
  // 멈추기를 누른 뒤에는 다음 축을 시작하지 않는다. 이동 중인 호출이 읽어야 해서 ref 로 둔다.
  const stopRequested = useRef(false);
  const move = useMoveSeat({
    onProgress: (steps, completed) =>
      dispatch({ type: "progressed", steps, completed }),
    isStopped: () => stopRequested.current,
  });
  const { mutate: stopSeat } = useStopSeat();
  // 음성 조절처럼 자동 조절 밖에서 시작한 이동도 포함해, 지금 시트가 움직이는 중인지.
  const seatMoving = useIsMutating({ mutationKey: bodyfitKeys.seatMove() }) > 0;

  const { run } = state;
  const moving = run !== null && run.outcome === null;
  const demoMoving = moving && run.demo;
  const realMoving = moving && !run.demo;
  const stopping = realMoving && run.stopping;

  // 시연: 모의 시트를 일정한 속도로 움직인다. 실제와 같이 기어가 P 에서 벗어나면 그 자리에서 멈춘다.
  useEffect(() => {
    if (!demoMoving) return;
    const timer = setInterval(
      () => dispatch({ type: "ticked", parked }),
      DEMO_MOVE_TICK_MS,
    );
    return () => clearInterval(timer);
  }, [demoMoving, parked]);

  // 다음 축이 막 시작된 순간에 멈추기를 누르면 첫 STOP 이 그 축을 놓칠 수 있다. 멈출 때까지 다시 보낸다.
  useEffect(() => {
    if (!stopping) return;
    const timer = setInterval(() => stopSeat(), STOP_RETRY_MS);
    return () => clearInterval(timer);
  }, [stopping, stopSeat]);

  // 진행 화면(멈추기 버튼)이 사라지면 실제 이동도 멈춘다. 멈출 수 없는 채로 시트가 움직이지 않게 한다.
  const realMovingRef = useRef(false);
  useEffect(() => {
    realMovingRef.current = realMoving;
  }, [realMoving]);
  useEffect(
    () => () => {
      if (!realMovingRef.current) return;
      stopRequested.current = true;
      stopSeat();
    },
    [stopSeat],
  );

  /** target 까지 움직인다. shown 은 화면에 보이던 지금 자세 (시연의 시작 위치로 쓴다). */
  const start = (target: SeatRatios, shown: SeatRatios | null) => {
    if (moving) return;
    if (state.demo) {
      dispatch({ type: "demoStarted", target, from: shown });
      return;
    }
    stopRequested.current = false;
    dispatch({ type: "started" });
    move.mutate(target, {
      onSuccess: () =>
        dispatch({ type: "settled", failed: false, errorCode: null }),
      onError: (error) =>
        dispatch({
          type: "settled",
          failed: true,
          errorCode: pleosErrorCode(error),
        }),
    });
  };

  const stop = () => {
    if (!moving) return;
    if (!run.demo) {
      stopRequested.current = true;
      stopSeat();
    }
    dispatch({ type: "stopRequested" });
  };

  return {
    /** 시연 모드를 쓸 수 있는지: contest 빌드를 에뮬레이터에서 돌릴 때만 (실차는 시트가 실제로 움직인다) */
    canDemo: canDemoSeat,
    demo: state.demo,
    /** 시연으로 움직인 모의 시트 위치. 시연 모드에서 화면의 "지금" 자세로 쓴다 */
    demoSeat: state.demoSeat,
    run,
    seatMoving,
    toggleDemo: () => {
      if (canDemoSeat) dispatch({ type: "demoToggled" });
    },
    start,
    stop,
    dismiss: () => dispatch({ type: "dismissed" }),
  };
}
