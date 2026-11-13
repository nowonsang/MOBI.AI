import { useIsMutating } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useEffectEvent, useRef } from "react";

import { useAppDispatch } from "@/core/store/hooks";
import { useGear } from "@/shared/pleos/use-gear";
import { useDriverSeatOccupancy } from "@/shared/pleos/use-seat-occupancy";

import { bodyfitKeys } from "../api/bodyfit.queries";
import {
  occupancyChanged,
  shouldReselectDriver,
} from "../model/bodyfit-boarding";
import { occupantChanged } from "../model/bodyfit-session.slice";

/**
 * 화면 없이 운전석 착좌를 따라간다 (A-4).
 * 주차 중에 운전석 착좌가 바뀌면 고른 운전자를 잊고 운전자 선택 화면을 띄운다.
 * 다음 사람이 고르지 않고 출발해도 앞사람 기록으로 남기지 않는다.
 * 앱이 실행 중일 때만 동작한다. 앱을 스스로 앞으로 띄우지는 않는다.
 */
export function BodyfitBoardingMonitor() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const gear = useGear();
  const occupied = useDriverSeatOccupancy();
  const seatMoving = useIsMutating({ mutationKey: bodyfitKeys.seatMove() }) > 0;
  const lastOccupied = useRef<boolean | null>(null);

  const onOccupancy = useEffectEvent((next: boolean) => {
    const changed = occupancyChanged(lastOccupied.current, next);
    lastOccupied.current = next;
    if (!shouldReselectDriver({ changed, gear, seatMoving })) return;
    dispatch(occupantChanged());
    // navigate 는 목록을 새로 쌓는다. 그러면 뒤로 가기로 앞사람 시트 화면에 돌아가므로 쌓인 목록까지 되돌린다.
    router.dismissTo("/bodyfit");
  });

  useEffect(() => {
    if (occupied !== null) onOccupancy(occupied);
  }, [occupied]);

  return null;
}
