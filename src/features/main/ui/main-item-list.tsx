"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/core/store/hooks";
import { useToggleMainItem } from "../api/main.mutations";
import { mainQueries } from "../api/main.queries";
import { matchesFilter, selectMainFilter } from "../model/main-filter.slice";

export function MainItemList() {
  const { data: items } = useSuspenseQuery(mainQueries.items());
  const filter = useAppSelector(selectMainFilter);
  const toggleItem = useToggleMainItem();

  const visibleItems = items.filter((item) => matchesFilter(item, filter));

  if (visibleItems.length === 0) {
    return (
      <p className="text-sm text-foreground/60">표시할 항목이 없습니다.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {visibleItems.map((item) => (
        <li key={item.id}>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => toggleItem.mutate(item.id)}
            />
            <span className={item.completed ? "line-through opacity-60" : ""}>
              {item.title}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
