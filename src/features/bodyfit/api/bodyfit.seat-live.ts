import { useQuery, useQueryClient } from "@tanstack/react-query";

import { usePleosEvent } from "@/shared/pleos/use-pleos-event";

import { bodyfitQueries } from "./bodyfit.queries";

/**
 * 운전석 상태를 읽고, 운전자가 시트 버튼을 누르는 동안 오는 위치 알림을 같은 캐시에 반영한다.
 * 가이드 조절처럼 실시간으로 봐야 하는 화면에서만 쓴다 (화면이 떠 있는 동안만 알림을 구독한다).
 */
export function useLiveDriverSeat({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const seat = bodyfitQueries.seat();

  // 범위·이동 가능 여부는 바뀌지 않으므로 알림이 올 때마다 다시 읽지 않고 그 축의 값만 바꾼다.
  usePleosEvent("onDriverSeatPositionChanged", ({ axis, value }) => {
    queryClient.setQueryData(seat.queryKey, (state) => {
      const axisState = state?.[axis];
      if (!state || !axisState) return state;
      return { ...state, [axis]: { ...axisState, value } };
    });
  });

  return useQuery({ ...seat, enabled });
}
