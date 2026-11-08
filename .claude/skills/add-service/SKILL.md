---
name: add-service
description: MOBI.AI에 새 서비스(도메인 모듈)를 추가하는 절차. "새 서비스/도메인/기능 영역 추가", "admin·user·payment 같은 서비스 만들기", "features 폴더에 새 모듈" 같은 요청에 사용한다. features/<서비스> + app/(<서비스>) + app/api/<서비스>를 main 서비스와 같은 모양으로 만든다.
argument-hint: <서비스 이름 (kebab-case, 예: admin, user-profile)>
---

# 새 서비스 추가

먼저 `project-architecture` 스킬의 규칙을 따른다. 참고 구현은 `src/features/main` 과 `src/app/(main)` 이며, 아래 템플릿은 그 구조를 서비스 이름만 바꿔 옮긴 것이다.

## 0. 확인할 것

- 서비스 이름: 소문자 kebab-case 단수 (`admin`, `user-profile`). 식별자에는 camelCase(`userProfile`)·PascalCase(`UserProfile`)로 쓴다.
- URL: 라우트 그룹 `(서비스)`는 URL에 나타나지 않는다. 페이지 URL을 사용자에게 확인한다 (예: `/admin`). `/` 는 main 서비스 전용이다.
- 다른 서비스의 데이터가 필요하면 서비스끼리 import 하지 말고 `app` 에서 조립하거나 `shared` 로 추출한다.

## 1. 만들 파일 (`admin` 예시)

```
src/features/admin/
├── model/admin.types.ts
├── model/admin-<주제>.slice.ts      # 클라이언트 전역 UI 상태가 있을 때만
├── server/admin.repository.ts       # import "server-only"
├── server/admin.data.ts             # 'use cache' 읽기
├── server/admin.actions.ts          # 'use server' 쓰기
├── api/admin.queries.ts             # 캐시 계약
├── api/admin.mutations.ts
└── ui/admin-<이름>.tsx
src/app/(admin)/layout.tsx
src/app/(admin)/admin/page.tsx
src/app/(admin)/admin/error.tsx
src/app/api/admin/<리소스>/route.ts
```

## 2. 핵심 템플릿

**캐시 계약** — `api/admin.queries.ts`

```ts
import { queryOptions } from "@tanstack/react-query";
import { http } from "@/shared/api/http";
import type { AdminUser } from "../model/admin.types";

export const adminKeys = {
  all: ["admin"] as const,
  users: () => [...adminKeys.all, "users"] as const,
};

export const adminTags = {
  users: "admin:users",
};

export const adminQueries = {
  users: () =>
    queryOptions({
      queryKey: adminKeys.users(),
      queryFn: ({ signal }) => http<AdminUser[]>("/api/admin/users", { signal }),
      staleTime: 30_000,
    }),
};
```

**서버 읽기** — `server/admin.data.ts`

```ts
import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { adminTags } from "../api/admin.queries";
import { findAdminUsers } from "./admin.repository";

export async function getAdminUsers() {
  "use cache";
  cacheLife("max");
  cacheTag(adminTags.users);

  return findAdminUsers();
}
```

> 사용자별 데이터(로그인 사용자 정보, 권한에 따라 다른 결과)는 `'use cache'` 로 캐시하지 않는다. 모든 사용자가 같은 결과를 공유하게 된다. `secure-coding` 스킬 참고.

**서버 쓰기** — `server/admin.actions.ts`

```ts
"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { adminTags } from "../api/admin.queries";
import { updateAdminUserRole } from "./admin.repository";

const inputSchema = z.object({
  userId: z.string().min(1).max(64),
  role: z.enum(["member", "admin"]),
});

export async function updateAdminUserRoleAction(input: z.input<typeof inputSchema>) {
  const { userId, role } = inputSchema.parse(input);
  // 인증·인가 확인을 여기(또는 repository)에서 한다. 페이지의 인증 검사는 Action까지 보호하지 않는다.

  const user = await updateAdminUserRole(userId, role);
  updateTag(adminTags.users);
  return user; // 화면에 필요한 필드만 담은 DTO
}
```

**페이지 조립** — `app/(admin)/admin/page.tsx`

```tsx
import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import { createHydrationState } from "@/core/query/hydration";
import { adminKeys, adminTags } from "@/features/admin/api/admin.queries";
import { getAdminUsers } from "@/features/admin/server/admin.data";
import { AdminUserList } from "@/features/admin/ui/admin-user-list";

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="text-sm">불러오는 중…</p>}>
      <AdminUsersData />
    </Suspense>
  );
}

async function AdminUsersData() {
  const users = await getAdminUsers();
  const state = await createHydrationState(
    [{ queryKey: adminKeys.users(), data: users }],
    { tags: [adminTags.users] },
  );

  return (
    <HydrationBoundary state={state}>
      <AdminUserList />
    </HydrationBoundary>
  );
}
```

나머지 파일(`*.mutations.ts`, `ui/*`, `layout.tsx`, `error.tsx`, `route.ts`, 슬라이스)은 `src/features/main` / `src/app/(main)` / `src/app/api/main` 의 같은 이름 파일을 복사해 이름만 바꾼다.

## 3. 연결

0. 테이블이 필요하면 `supabase-schema` 스킬을 로드하고 그 규칙대로 `supabase/migrations/<YYYYMMDDHHMMSS>_create_<서비스>_<테이블>.sql` 을 만든다. 테이블 이름은 `mobi_ai.<서비스>_<복수형>` (예: `mobi_ai.admin_users`). `npm run check:migrations` 통과 → `src/shared/supabase/database.types.ts` 갱신 → 사용자에게 SQL Editor 실행 요청 순서로 진행한다.
1. Redux 슬라이스를 만들었다면 `src/core/store/store.ts` 의 `combineSlices(...)` 에 추가한다.
2. 외부 도메인(API 서버, 이미지 CDN)을 쓰면 `next.config.ts` 의 CSP 해당 지시어에 **필요한 도메인만** 추가한다.
3. 새 환경 변수가 필요하면 `src/shared/config/server-env.ts` 스키마에 추가하고 README "환경 변수"에 이름만 기록한다.
4. `README.md` 폴더 구조에 서비스를 추가한다.

## 4. 검증

`npm run lint && npm run typecheck && npm run build` 가 모두 통과해야 완료다 (`lint` 에 마이그레이션 검사 포함). 빌드 결과의 Route 표에서 새 페이지와 API 경로를 확인한다. 새 테이블을 썼다면 사용자가 SQL을 실행한 뒤에야 빌드가 통과한다.
