"use client";

import type { ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 서버에서 hydrate된 데이터를 브라우저가 곧바로 다시 요청하지 않도록 0보다 크게 둔다.
        staleTime: 60_000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // 서버: 렌더마다 새로 만든다 (요청 간 캐시 공유 방지).
  // 브라우저: 하나를 재사용한다 (Suspense 재시도 시 캐시 유실 방지).
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
      {/* production 빌드에서는 패키지가 빈 컴포넌트를 내보낸다. */}
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
