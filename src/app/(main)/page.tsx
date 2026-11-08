import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import { createHydrationState } from "@/core/query/hydration";
import { mainKeys, mainTags } from "@/features/main/api/main.queries";
import { getMainItems } from "@/features/main/server/main.data";
import { MainFilterBar } from "@/features/main/ui/main-filter-bar";
import { MainItemList } from "@/features/main/ui/main-item-list";

// 라우트 파일은 얇게 유지한다: 데이터 프리페치 + feature 컴포넌트 조립만 담당.
export default function MainPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">MOBI.AI</h1>
      <MainFilterBar />
      {/* Cache Components는 클라이언트 컴포넌트도 프리렌더하므로, 쿼리를 읽는 부분은 Suspense 안에 둔다. */}
      <Suspense fallback={<p className="text-sm">불러오는 중…</p>}>
        <MainItemsData />
      </Suspense>
    </>
  );
}

async function MainItemsData() {
  const items = await getMainItems();
  const state = await createHydrationState(
    [{ queryKey: mainKeys.items(), data: items }],
    { tags: [mainTags.items] },
  );

  return (
    <HydrationBoundary state={state}>
      <MainItemList />
    </HydrationBoundary>
  );
}
