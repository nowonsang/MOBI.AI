import "server-only";

import { getSupabaseAdminClient } from "@/shared/supabase/admin";
import type { MainItem } from "../model/main.types";

// 화면에 필요한 컬럼만 조회한다 (DTO). created_at 등 내부 컬럼은 클라이언트로 보내지 않는다.
const ITEM_COLUMNS = "id, title, completed";

export async function findMainItems(): Promise<MainItem[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("main_items")
    .select(ITEM_COLUMNS)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(`main_items 조회 실패 (${error.code})`);
  return data;
}

export async function toggleMainItem(id: string): Promise<MainItem> {
  // 읽고-쓰기 경쟁 상태를 피하려고 DB 함수 하나로 원자적으로 토글한다.
  const { data, error } = await getSupabaseAdminClient().rpc(
    "toggle_main_item",
    { item_id: id },
  );

  if (error) throw new Error(`main_items 토글 실패 (${error.code})`);
  if (!data?.id) throw new Error("항목을 찾을 수 없습니다");
  return { id: data.id, title: data.title, completed: data.completed };
}
