import { queryOptions } from "@tanstack/react-query";

import { pleos } from "@/shared/pleos/pleos";

import { shouldRereadSeat } from "../model/bodyfit-seat";

import {
  findBodyProfile,
  findBodyProfiles,
  findSeatAdjustments,
} from "./bodyfit.storage";

// 캐시 계약: query key 는 반드시 여기서 만든다 (서비스 이름으로 시작해 다른 서비스와 충돌하지 않게).
export const bodyfitKeys = {
  all: ["bodyfit"] as const,
  profiles: () => [...bodyfitKeys.all, "profiles"] as const,
  profile: (id: string) => [...bodyfitKeys.profiles(), id] as const,
  adjustments: (profileId: string) =>
    [...bodyfitKeys.all, "adjustments", profileId] as const,
  seat: () => [...bodyfitKeys.all, "seat"] as const,
};

export const bodyfitQueries = {
  profiles: () =>
    queryOptions({
      queryKey: bodyfitKeys.profiles(),
      queryFn: findBodyProfiles,
    }),
  profile: (id: string) =>
    queryOptions({
      queryKey: bodyfitKeys.profile(id),
      queryFn: () => findBodyProfile(id),
    }),
  adjustments: (profileId: string) =>
    queryOptions({
      queryKey: bodyfitKeys.adjustments(profileId),
      queryFn: () => findSeatAdjustments(profileId),
    }),
  /** 운전석의 현재 위치와 지원 범위. 운전자가 버튼으로 바꿀 수 있어 항상 다시 읽는다. */
  seat: () =>
    queryOptions({
      queryKey: bodyfitKeys.seat(),
      queryFn: () => pleos().getDriverSeatState(),
      staleTime: 0,
      // 앱을 켠 직후에는 차량 서비스 연결 전이라 빈 상태가 온다. 그때만 1초 간격으로 몇 번 더 읽는다.
      refetchInterval: (query) =>
        shouldRereadSeat(query.state.data, query.state.dataUpdateCount)
          ? 1000
          : false,
    }),
};
