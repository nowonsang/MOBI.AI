import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { MainItem, MainItemFilter } from "./main.types";

// 서버 데이터가 아닌 클라이언트 UI 상태만 Redux에 둔다. (서버 데이터는 TanStack Query 담당)
type MainFilterState = {
  value: MainItemFilter;
};

const initialState: MainFilterState = {
  value: "all",
};

export const mainFilterSlice = createSlice({
  name: "mainFilter",
  initialState,
  reducers: {
    filterChanged(state, action: PayloadAction<MainItemFilter>) {
      state.value = action.payload;
    },
  },
  selectors: {
    selectMainFilter: (state) => state.value,
  },
});

export const { filterChanged } = mainFilterSlice.actions;
export const { selectMainFilter } = mainFilterSlice.selectors;

export function matchesFilter(item: MainItem, filter: MainItemFilter) {
  if (filter === "active") return !item.completed;
  if (filter === "completed") return item.completed;
  return true;
}
