"use client";

import { useAppDispatch, useAppSelector } from "@/core/store/hooks";
import { filterChanged, selectMainFilter } from "../model/main-filter.slice";
import type { MainItemFilter } from "../model/main.types";

const FILTERS: { value: MainItemFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "진행 중" },
  { value: "completed", label: "완료" },
];

export function MainFilterBar() {
  const current = useAppSelector(selectMainFilter);
  const dispatch = useAppDispatch();

  return (
    <div role="group" aria-label="항목 필터" className="flex gap-2">
      {FILTERS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={current === value}
          onClick={() => dispatch(filterChanged(value))}
          className="rounded-full border border-foreground/15 px-3 py-1 text-sm aria-pressed:bg-foreground aria-pressed:text-background"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
