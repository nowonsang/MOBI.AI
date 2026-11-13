import { queryOptions } from "@tanstack/react-query";

import { pleos } from "@/shared/pleos/pleos";

import { shouldRereadSeat } from "../model/bodyfit-seat";

import {
  findBodyProfile,
  findBodyProfiles,
  findBoardings,
  findComfortRecords,
  findSeatAdjustments,
} from "./bodyfit.storage";

// 캐시 계약: query key 는 반드시 여기서 만든다 (서비스 이름으로 시작해 다른 서비스와 충돌하지 않게).
export const bodyfitKeys = {
  all: ["bodyfit"] as const,
  profiles: () => [...bodyfitKeys.all, "profiles"] as const,
  profile: (id: string) => [...bodyfitKeys.profiles(), id] as const,
  adjustments: (profileId: string) =>
    [...bodyfitKeys.all, "adjustments", profileId] as const,
  boardings: () => [...bodyfitKeys.all, "boardings"] as const,
  seat: () => [...bodyfitKeys.all, "seat"] as const,
  /** 시트 이동 뮤테이션. 화면 밖에서도 "움직이는 중"인지 알 수 있게 (useIsMutating) */
  seatMove: () => [...bodyfitKeys.all, "seat-move"] as const,
  comfortRecords: (profileId: string) =>
    [...bodyfitKeys.all, "comfort-records", profileId] as const,
  comfort: () => [...bodyfitKeys.all, "comfort"] as const,
  naviRoute: () => [...bodyfitKeys.all, "navi-route"] as const,
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
  /**
   * 모든 운전자의 주행 시작 기록. 출발할 때마다 늘어나는데 기록하는 곳(주행 감시)이 여러 운전자 키를 무효화하지 않으므로,
   * 운전자 선택 화면을 열 때마다 다시 읽는다 (기기 저장소라 빠르다).
   */
  boardings: () =>
    queryOptions({
      queryKey: bodyfitKeys.boardings(),
      queryFn: findBoardings,
      staleTime: 0,
    }),
  adjustments: (profileId: string) =>
    queryOptions({
      queryKey: bodyfitKeys.adjustments(profileId),
      queryFn: () => findSeatAdjustments(profileId),
    }),
  comfortRecords: (profileId: string) =>
    queryOptions({
      queryKey: bodyfitKeys.comfortRecords(profileId),
      queryFn: () => findComfortRecords(profileId),
    }),
  /** 운전석 열선·공조 상태와 지금 실내 온도. 운전자가 버튼으로 바꿀 수 있어 항상 다시 읽는다. */
  comfort: () =>
    queryOptions({
      queryKey: bodyfitKeys.comfort(),
      queryFn: () => pleos().getDriverComfortState(),
      staleTime: 0,
    }),
  /**
   * 내비게이션 목적지까지 남은 거리·시간 (C-5 상황 제안). 목적지가 없으면 null.
   * 목적지는 밖에서 바뀌므로 항상 다시 읽고, 화면을 떠나면 값을 남기지 않는다 (그 순간에만 쓴다).
   */
  naviRoute: () =>
    queryOptions({
      queryKey: bodyfitKeys.naviRoute(),
      queryFn: () => pleos().getNaviRoute(),
      staleTime: 0,
      gcTime: 0,
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
