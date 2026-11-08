# 서비스 파일 템플릿 (`admin` 예시)

`SKILL.md` 의 캐시 계약·서버 읽기·서버 쓰기·페이지 템플릿과 함께 쓰는 나머지 파일들이다.
가상의 `admin` 서비스(관리자 사용자 목록, 역할 필터, 역할 변경)를 예로 들었다. 서비스 이름·엔티티만 바꿔 쓴다.

## 마이그레이션 — `supabase/migrations/<YYYYMMDDHHMMSS>_create_admin_users.sql`

```sql
begin;

create table if not exists mobi_ai.admin_users (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table mobi_ai.admin_users enable row level security;
revoke all on table mobi_ai.admin_users from public, anon, authenticated;
grant select, insert, update, delete on table mobi_ai.admin_users to service_role;

-- mobi_ai.set_updated_at() 은 첫 마이그레이션에서 만든 공통 함수다.
drop trigger if exists admin_users_set_updated_at on mobi_ai.admin_users;
create trigger admin_users_set_updated_at
  before update on mobi_ai.admin_users
  for each row execute function mobi_ai.set_updated_at();

commit;

notify pgrst, 'reload schema';
```

`src/shared/supabase/database.types.ts` 의 `mobi_ai.Tables` 에 `admin_users` 의 `Row`/`Insert`/`Update`/`Relationships: []` 를 추가한다.

## 타입 — `features/admin/model/admin.types.ts`

```ts
export type AdminUserRole = "member" | "admin";

export type AdminUser = {
  id: string;
  name: string;
  role: AdminUserRole;
};

export type AdminRoleFilter = "all" | AdminUserRole;
```

## 클라이언트 UI 상태 — `features/admin/model/admin-role-filter.slice.ts`

서버 데이터가 아닌 UI 상태만 둔다. 만든 뒤 `src/core/store/store.ts` 의 `combineSlices(...)` 에 등록한다.

```ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AdminRoleFilter, AdminUser } from "./admin.types";

const initialState: { value: AdminRoleFilter } = { value: "all" };

export const adminRoleFilterSlice = createSlice({
  name: "adminRoleFilter",
  initialState,
  reducers: {
    roleFilterChanged(state, action: PayloadAction<AdminRoleFilter>) {
      state.value = action.payload;
    },
  },
  selectors: {
    selectAdminRoleFilter: (state) => state.value,
  },
});

export const { roleFilterChanged } = adminRoleFilterSlice.actions;
export const { selectAdminRoleFilter } = adminRoleFilterSlice.selectors;

export function matchesRoleFilter(user: AdminUser, filter: AdminRoleFilter) {
  return filter === "all" || user.role === filter;
}
```

## 저장소(DAL) — `features/admin/server/admin.repository.ts`

```ts
import "server-only";

import { getSupabaseAdminClient } from "@/shared/supabase/admin";
import type { AdminUser, AdminUserRole } from "../model/admin.types";

// 화면에 필요한 컬럼만 조회한다 (DTO).
const USER_COLUMNS = "id, name, role";

export async function findAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await getSupabaseAdminClient()
    .from("admin_users")
    .select(USER_COLUMNS)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(`admin_users 조회 실패 (${error.code})`);
  return data as AdminUser[];
}

export async function updateAdminUserRole(
  id: string,
  role: AdminUserRole,
): Promise<AdminUser> {
  const { data, error } = await getSupabaseAdminClient()
    .from("admin_users")
    .update({ role })
    .eq("id", id)
    .select(USER_COLUMNS)
    .maybeSingle();

  if (error) throw new Error(`admin_users 수정 실패 (${error.code})`);
  if (!data) throw new Error("사용자를 찾을 수 없습니다");
  return data as AdminUser;
}
```

> 토글·카운터처럼 "읽고 바로 쓰는" 변경은 경쟁 상태를 피하려고 `mobi_ai` 함수로 만들고 `.rpc()` 로 호출한다 (`supabase-schema` 스킬).

## 뮤테이션 훅 — `features/admin/api/admin.mutations.ts`

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AdminUserRole } from "../model/admin.types";
import { updateAdminUserRoleAction } from "../server/admin.actions";
import { adminQueries } from "./admin.queries";

export function useUpdateAdminUserRole() {
  const queryClient = useQueryClient();
  const { queryKey } = adminQueries.users();

  return useMutation({
    // mutationFn의 두 번째 인자(QueryClient 포함)는 직렬화할 수 없으므로 Server Action에 그대로 넘기지 않는다.
    mutationFn: (input: { userId: string; role: AdminUserRole }) =>
      updateAdminUserRoleAction(input),
    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (users) =>
        users?.map((user) => (user.id === userId ? { ...user, role } : user)),
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
```

## UI — `features/admin/ui/admin-user-list.tsx`

```tsx
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useAppSelector } from "@/core/store/hooks";
import { useUpdateAdminUserRole } from "../api/admin.mutations";
import { adminQueries } from "../api/admin.queries";
import {
  matchesRoleFilter,
  selectAdminRoleFilter,
} from "../model/admin-role-filter.slice";
import type { AdminUserRole } from "../model/admin.types";

export function AdminUserList() {
  const { data: users } = useSuspenseQuery(adminQueries.users());
  const filter = useAppSelector(selectAdminRoleFilter);
  const updateRole = useUpdateAdminUserRole();

  const visibleUsers = users.filter((user) => matchesRoleFilter(user, filter));

  if (visibleUsers.length === 0) {
    return (
      <p className="py-10 text-center text-body text-ink-tertiary">
        아직 등록된 사용자가 없어요.
      </p>
    );
  }

  // 모바일 우선 세로 목록, 행 높이 56px 이상, 구분선은 line 토큰 (ui-design 스킬)
  return (
    <ul className="flex flex-col divide-y divide-line">
      {visibleUsers.map((user) => (
        <li
          key={user.id}
          className="flex min-h-14 items-center justify-between gap-3 py-3"
        >
          <span className="text-body text-ink">{user.name}</span>
          <select
            className="h-11 rounded-control border border-line bg-surface px-3 text-body-sm text-ink focus:border-primary"
            aria-label={`${user.name} 역할`}
            value={user.role}
            onChange={(event) =>
              updateRole.mutate({
                userId: user.id,
                role: event.target.value as AdminUserRole,
              })
            }
          >
            <option value="member">멤버</option>
            <option value="admin">관리자</option>
          </select>
        </li>
      ))}
    </ul>
  );
}
```

필터 버튼 같은 Redux 상태 조작 컴포넌트는 `useAppSelector(selectAdminRoleFilter)` + `useAppDispatch()(roleFilterChanged(value))` 로 만든다.

## Route Handler — `app/api/admin/users/route.ts`

TanStack Query가 브라우저에서 재요청할 때 쓰는 엔드포인트다. **공개 엔드포인트이므로 인증·인가 확인을 반드시 넣는다** (`secure-coding` 스킬).

```ts
import { findAdminUsers } from "@/features/admin/server/admin.repository";

export async function GET() {
  // TODO(인증): 로그인·관리자 권한을 확인하고, 아니면 401/403 을 반환한다.
  return Response.json(await findAdminUsers());
}
```

## 라우트 그룹 — `app/(admin)/layout.tsx`, `app/(admin)/admin/error.tsx`

```tsx
// app/(admin)/layout.tsx — 서비스 전용 레이아웃 (반응형 여백·폭은 ui-design 스킬 4장)
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-5 py-12 md:px-6 md:py-16 lg:px-7.5 lg:py-20">
      {children}
    </main>
  );
}
```

```tsx
// app/(admin)/admin/error.tsx — 쿼리 에러 경계 (복구 함수는 reset 이 아니라 retry)
"use client";

import { useEffect } from "react";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";

export default function AdminError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const { reset } = useQueryErrorResetBoundary();

  useEffect(() => {
    console.error(error);
  }, [error]);

  // 실패 화면: 탓하지 않는 해요체 + 다음 행동 1개 (ui-design 스킬 2·6장)
  return (
    <div className="mx-auto flex w-full max-w-narrow flex-col gap-3 py-10 text-center">
      <h2 className="text-heading font-bold text-ink lg:text-heading-lg">
        잠시 문제가 생겼어요
      </h2>
      <p className="text-body text-ink-tertiary">
        네트워크 상태를 확인하고 다시 시도해 주세요.
      </p>
      <button
        type="button"
        className="mt-4 h-13 w-full rounded-control bg-primary px-5 text-body-lg font-bold text-surface transition-colors hover:bg-primary-strong md:mx-auto md:w-auto md:min-w-60"
        onClick={() => {
          reset();
          retry();
        }}
      >
        다시 시도하기
      </button>
    </div>
  );
}
```
