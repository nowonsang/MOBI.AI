import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { mainFilterSlice } from "@/features/main/model/main-filter.slice";

// 새 슬라이스는 여기에 추가한다. 각 슬라이스의 reducerPath(기본값: name)가 state key가 된다.
const rootReducer = combineSlices(mainFilterSlice);

export type RootState = ReturnType<typeof rootReducer>;

export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
