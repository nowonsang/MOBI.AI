---
name: add-service
description: MOBI.AI에 새 서비스(도메인 모듈)를 추가하는 절차. "새 서비스/도메인/기능 영역 추가", "admin·user·payment 같은 서비스 만들기", "features 폴더에 새 모듈" 같은 요청에 사용한다. features/<서비스> + app/(<서비스>) + app/api/<서비스>를 main 서비스와 같은 모양으로 만든다.
argument-hint: <서비스 이름 (kebab-case, 예: admin, user-profile)>
---

# 새 서비스 추가

먼저 `project-architecture` 스킬의 규칙을 따른다. 이 프로젝트의 참고 구현은 이 스킬의 템플릿이다: 핵심 4개 파일은 아래에, 나머지 파일(마이그레이션, 타입, 슬라이스, 저장소, 뮤테이션, UI, Route Handler, 레이아웃, 에러 경계)은 같은 폴더의 [`templates.md`](templates.md) 에 있다.

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
├── server/admin.data.ts             # 서버 컴포넌트용 읽기 (권한 확인·DTO)
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

import { findAdminUsers } from "./admin.repository";

// 서버 컴포넌트용 읽기 함수. 인증·인가 확인과 DTO 변환을 여기(또는 repository)에서 한다.
export async function getAdminUsers() {
  return findAdminUsers();
}
```

> 서버 캐시(`'use cache'`, `unstable_cache`)는 쓰지 않는다. Cloudflare Workers 에서 Cache Components 가 동작하지 않고, 서버 캐시 저장소(R2·D1)도 아직 없다. 브라우저 캐시는 TanStack Query 가 맡는다.

**서버 쓰기** — `server/admin.actions.ts`

```ts
"use server";

import { z } from "zod";
import { updateAdminUserRole } from "./admin.repository";

const inputSchema = z.object({
  userId: z.string().min(1).max(64),
  role: z.enum(["member", "admin"]),
});

export async function updateAdminUserRoleAction(input: z.input<typeof inputSchema>) {
  const { userId, role } = inputSchema.parse(input);
  // 인증·인가 확인을 여기(또는 repository)에서 한다. 페이지의 인증 검사는 Action까지 보호하지 않는다.

  // 서버 캐시가 없으므로 무효화할 것이 없다. 브라우저 쪽은 뮤테이션 훅의 invalidateQueries 가 갱신한다.
  return updateAdminUserRole(userId, role); // 화면에 필요한 필드만 담은 DTO
}
```

**페이지 조립** — `app/(admin)/admin/page.tsx`

```tsx
import { Suspense } from "react";
import { connection } from "next/server";
import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from "@tanstack/react-query";
import { adminQueries } from "@/features/admin/api/admin.queries";
import { getAdminUsers } from "@/features/admin/server/admin.data";
import { AdminUserList } from "@/features/admin/ui/admin-user-list";

export default function AdminPage() {
  return (
    // 로딩은 실제 목록 모양의 스켈레톤으로 (ui-design 스킬 6장)
    <Suspense
      fallback={
        <div
          role="status"
          aria-label="불러오는 중"
          className="h-56 animate-pulse rounded-control bg-sand-light"
        />
      }
    >
      <AdminUsersData />
    </Suspense>
  );
}

async function AdminUsersData() {
  // DB 데이터는 요청마다 새로 읽는다 (빌드 시점 데이터로 정적 페이지가 굳지 않게).
  await connection();

  // 서버에서 같은 쿼리 키로 미리 채워 브라우저로 넘긴다. 상대 경로 fetch 는 서버에서 안 되므로 queryFn 을 서버 함수로 바꾼다.
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    ...adminQueries.users(),
    queryFn: () => getAdminUsers(),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminUserList />
    </HydrationBoundary>
  );
}
```

나머지 파일(마이그레이션, `*.types.ts`, 슬라이스, `*.repository.ts`, `*.mutations.ts`, `ui/*`, `route.ts`, `layout.tsx`, `error.tsx`)은 [`templates.md`](templates.md) 의 `admin` 예시를 서비스 이름만 바꿔 쓴다.

## 3. 연결

0. 테이블이 필요하면 `supabase-schema` 스킬을 로드하고 그 규칙대로 `supabase/migrations/<YYYYMMDDHHMMSS>_create_<서비스>_<테이블>.sql` 을 만든다. 테이블 이름은 `mobi_ai.<서비스>_<복수형>` (예: `mobi_ai.admin_users`). `npm run check:migrations` 통과 → `src/shared/supabase/database.types.ts` 갱신 → 사용자에게 SQL Editor 실행 요청 순서로 진행한다.
1. Redux 슬라이스를 만들었다면 `src/core/store/store.ts` 의 `combineSlices(...)` 에 추가한다.
2. 외부 도메인(API 서버, 이미지 CDN)을 쓰면 `next.config.ts` 의 CSP 해당 지시어에 **필요한 도메인만** 추가한다.
3. 새 환경 변수가 필요하면 `src/shared/config/server-env.ts` 스키마에 추가하고 README "환경 변수"에 이름만 기록한다.
4. `README.md` 폴더 구조에 서비스를 추가한다.

## 4. 검증

`npm run lint && npm run typecheck && npm run build` 가 모두 통과해야 완료다 (`lint` 에 마이그레이션 검사 포함). 빌드 결과의 Route 표에서 새 페이지와 API 경로를 확인한다. 새 테이블을 썼다면 사용자가 SQL을 실행한 뒤에야 빌드가 통과한다.
