import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";

import { makeStore } from "./store/store";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // 기기 안 저장소·차량 값은 화면 복귀 때 다시 읽을 필요가 없다. 바뀌면 뮤테이션에서 무효화한다.
          queries: { staleTime: Infinity, retry: false },
          mutations: { retry: false },
        },
      }),
  );
  const [store] = useState(makeStore);

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
}
