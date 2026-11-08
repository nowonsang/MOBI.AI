"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { mainTags } from "../api/main.queries";
import { toggleMainItem } from "./main.repository";

// Server Action은 누구나 호출할 수 있는 공개 엔드포인트다. 타입 선언과 무관하게 런타임에서 입력을 검증한다.
const itemIdSchema = z.string().min(1).max(64);

export async function toggleMainItemAction(id: string) {
  const itemId = itemIdSchema.parse(id);

  const item = await toggleMainItem(itemId);
  updateTag(mainTags.items);
  return item;
}
