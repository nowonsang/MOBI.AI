import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import {
  QueryClient,
  defaultShouldDehydrateQuery,
  type DehydratedState,
  type QueryKey,
} from "@tanstack/react-query";

type HydratedQuery = {
  queryKey: QueryKey;
  data: unknown;
};

async function getHydrationUpdatedAt(tags: string[]) {
  "use cache";
  cacheTag(...tags);
  cacheLife("max");
  return Date.now();
}

/**
 * Cache Components 환경용 dehydrate.
 *
 * TanStack의 `dehydrate()`는 프리렌더 중 `Date.now()`를 읽어 빌드 에러를 낸다.
 * 타임스탬프를 데이터와 같은 태그로 캐시해, 태그가 무효화되면 데이터와 시각이 함께 갱신되게 한다.
 * `tags`에는 원본 데이터 함수의 `cacheTag`와 같은 값을 넘긴다.
 */
export async function createHydrationState(
  queries: HydratedQuery[],
  { tags }: { tags: string[] },
): Promise<DehydratedState> {
  const updatedAt = await getHydrationUpdatedAt(tags);
  const queryClient = new QueryClient();

  for (const query of queries) {
    queryClient.setQueryData(query.queryKey, query.data, { updatedAt });
  }

  return {
    mutations: [],
    queries: queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => defaultShouldDehydrateQuery(query))
      .map((query) => ({
        dehydratedAt: updatedAt,
        queryHash: query.queryHash,
        queryKey: query.queryKey,
        state: query.state,
        ...(query.meta ? { meta: query.meta } : {}),
      })),
  };
}
