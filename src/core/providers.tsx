import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
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

  // Pleos 앱 구조 가이드: 포그라운드로 돌아오면 현재 상태를 다시 읽는다.
  // React Native 에는 창 포커스 이벤트가 없어 AppState 로 알려 준다 (staleTime 0 인 시트 값만 다시 읽힌다).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) =>
      focusManager.setFocused(status === "active"),
    );
    return () => subscription.remove();
  }, []);

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
}
