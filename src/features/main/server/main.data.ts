import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { mainTags } from "../api/main.queries";
import { findMainItems } from "./main.repository";

// 서버 컴포넌트용 읽기 함수. 쓰기 쪽(main.actions.ts)이 같은 태그를 updateTag로 무효화한다.
export async function getMainItems() {
  "use cache";
  cacheLife("max");
  cacheTag(mainTags.items);

  return findMainItems();
}
