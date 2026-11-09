import { configureStore } from "@reduxjs/toolkit";

import { bodyfitSessionSlice } from "@/features/bodyfit/model/bodyfit-session.slice";

// 클라이언트 전역 UI 상태만 둔다. 저장된 데이터·차량 값은 TanStack Query 캐시가 담당한다.
export function makeStore() {
  return configureStore({
    reducer: {
      [bodyfitSessionSlice.name]: bodyfitSessionSlice.reducer,
    },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
