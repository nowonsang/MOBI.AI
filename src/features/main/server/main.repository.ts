import "server-only";

import type { MainItem } from "../model/main.types";

// 예제용 인메모리 저장소. 실제 프로젝트에서는 DB 또는 외부 API 호출로 교체한다.
// Route Handler·Server Action·RSC는 서로 다른 번들로 로드될 수 있어 globalThis에 둔다.
const globalForMain = globalThis as typeof globalThis & {
  __mainItems?: MainItem[];
};

function getStore() {
  globalForMain.__mainItems ??= [
    { id: "1", title: "프로젝트 구조 잡기", completed: true },
    { id: "2", title: "API 연동하기", completed: false },
    { id: "3", title: "배포 파이프라인 구성", completed: false },
  ];
  return globalForMain.__mainItems;
}

export async function findMainItems(): Promise<MainItem[]> {
  return structuredClone(getStore());
}

export async function toggleMainItem(id: string): Promise<MainItem> {
  const item = getStore().find((entry) => entry.id === id);
  if (!item) throw new Error(`Main item ${id} not found`);

  item.completed = !item.completed;
  return { ...item };
}
