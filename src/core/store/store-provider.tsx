"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeStore } from "./store";

export function StoreProvider({ children }: { children: ReactNode }) {
  // 모듈 전역 스토어는 서버에서 요청 간 상태가 섞이므로, 렌더 트리마다 한 번만 생성한다.
  const [store] = useState(() => makeStore());

  return <Provider store={store}>{children}</Provider>;
}
