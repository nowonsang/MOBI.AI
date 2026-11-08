import { queryOptions } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import type { MainItem } from "../model/main.types";

// 캐시 계약: 브라우저 캐시(query key)와 서버 캐시(cache tag)를 한곳에서 정의한다.
// 서버·클라이언트 양쪽에서 import 하므로 server-only / client-only 모듈을 가져오지 않는다.
// 키와 태그 앞에 서비스 이름(main)을 붙여 다른 서비스와 캐시가 겹치지 않게 한다.

export const mainKeys = {
  all: ["main"] as const,
  items: () => [...mainKeys.all, "items"] as const,
};

export const mainTags = {
  items: "main:items",
};

export const mainQueries = {
  items: () =>
    queryOptions({
      queryKey: mainKeys.items(),
      queryFn: ({ signal }) => http<MainItem[]>("/api/main/items", { signal }),
      staleTime: 30_000,
    }),
};
