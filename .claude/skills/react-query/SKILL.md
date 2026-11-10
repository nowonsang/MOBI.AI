---
name: react-query
description: MOBI.AI 의 TanStack Query(React Query v5) 규칙. 비동기로 읽는 데이터(기기 저장소, 차량 값)를 조회·변경·캐시 무효화하는 코드를 추가·변경·리뷰할 때 반드시 로드한다. query key 팩토리와 queryOptions 캐시 계약, staleTime 기준, useQuery·useMutation 사용법, 무효화·낙관적 업데이트, 로딩·에러 처리, 금지 사항을 정의한다.
---

# TanStack Query (React Query v5)

참고 구현: `src/features/bodyfit/api/bodyfit.queries.ts`, `bodyfit.mutations.ts`. QueryClient 설정은 `src/core/providers.tsx`.

## 1. 무엇을 Query 로 다루나

- **비동기로 읽는 모든 데이터**: 기기 저장소(`api/*.storage.ts`), 차량 값(`pleos().getDriverSeatState()` 등).
- 읽은 데이터를 Redux·`useState` 에 복사하지 않는다. 화면은 항상 Query 캐시에서 읽는다.
- 앱 전역 UI 상태는 Redux (`redux-toolkit` 스킬), 차량이 밀어 주는 이벤트(기어 변경 등)는 `usePleosEvent`.

## 2. 캐시 계약 (`api/<서비스>.queries.ts`)

```ts
export const bodyfitKeys = {
  all: ["bodyfit"] as const,
  profiles: () => [...bodyfitKeys.all, "profiles"] as const,
  profile: (id: string) => [...bodyfitKeys.profiles(), id] as const,
};

export const bodyfitQueries = {
  profile: (id: string) =>
    queryOptions({ queryKey: bodyfitKeys.profile(id), queryFn: () => findBodyProfile(id) }),
};
```

- query key 는 반드시 `<서비스>Keys` 팩토리로 만든다. 첫 요소는 서비스 이름이다 (서비스 간 충돌 방지). 문자열 배열을 하드코딩하지 않는다.
- key 는 넓은 것 → 좁은 것 순서로 쌓는다. 그래야 `invalidateQueries({ queryKey: bodyfitKeys.profiles() })` 로 하위 key 를 한 번에 무효화할 수 있다.
- `queryFn` 이 쓰는 값(id 등)은 모두 key 에 들어가야 한다.
- 화면은 `useQuery(bodyfitQueries.profile(id))` 처럼 `queryOptions` 를 그대로 넘긴다. 옵션을 덧붙일 때는 펼쳐서 쓴다: `useQuery({ ...bodyfitQueries.seat(), enabled: connected })`.

## 3. staleTime 기준

- 기본값(`core/providers.tsx`): `staleTime: Infinity`, `retry: false`. 기기 저장소는 앱만 바꾸므로 뮤테이션에서 무효화하면 충분하다.
- **차량처럼 밖에서 바뀌는 데이터는 `staleTime: 0`** (예: 운전자가 버튼으로 시트를 움직일 수 있다).
- 차량 호출은 자동 재시도하지 않는다 (`retry: false`). 실패 원인은 에러 코드로 안내한다.

## 4. 뮤테이션 (`api/<서비스>.mutations.ts`)

- 훅 이름은 `use<동사><대상>` (`useMoveSeat`, `useCreateBodyProfile`). `mutationFn` 은 `api/` 의 함수를 호출한다. 컴포넌트에서 저장소·SDK 를 직접 호출하지 않는다.
- `onSettled` 에서 영향을 받는 key 를 `invalidateQueries` 한다 (성공·실패 모두).
- 즉시 반응이 필요한 저장(0.25초 규칙, `ui-design` 스킬)은 낙관적 업데이트: `onMutate` 에서 `cancelQueries` → 이전 값 저장 → `setQueryData` → `onError` 에서 롤백 → `onSettled` 에서 무효화.
- **차량을 움직이는 뮤테이션은 낙관적 업데이트를 하지 않는다.** 실제 위치는 차량에서 다시 읽는다.
- 화면별 후처리(문구 표시, 이동)는 `mutate(variables, { onSuccess })` 의 호출 쪽 콜백에 둔다. 훅 정의 쪽 콜백에는 캐시 처리만 둔다.

## 5. 화면에서

- 상태 분기 순서: `isPending` → 스켈레톤, `isError` → `StatusView` + "다시 불러오기"(`refetch`), 빈 데이터 → 빈 상태 `StatusView`, 그다음 내용 (`ui-design` 스킬).
- 조건부 조회는 `enabled` 로 막는다 (예: 차량이 아니면 시트 조회 안 함). `enabled: false` 인 동안에는 `isPending` 이 계속 true 이므로 분기에 유의한다.
- 뮤테이션 진행 중에는 버튼 `loading` 으로 중복 실행을 막는다.
- 에러 문구는 `pleosErrorCode(error)` → `ui/*-error-copy.ts` 로 고른다. `error.message` 를 화면에 그대로 보여 주지 않는다.

## 6. 금지

- 조회 결과를 Redux·`useState` 에 복사
- query key 하드코딩, `<서비스>Keys` 를 거치지 않은 key
- `useEffect` 안에서 데이터를 불러와 `setState` (→ `useQuery`)
- RTK Query·SWR 같은 두 번째 데이터 캐시 도입

## 7. 체크리스트

- [ ] key 는 `<서비스>Keys` 로 만들고 `queryFn` 의 모든 입력이 key 에 있다
- [ ] 밖에서 바뀌는 데이터는 `staleTime: 0`
- [ ] 뮤테이션 `onSettled` 에서 관련 key 를 무효화한다
- [ ] 로딩·에러·빈 상태를 모두 처리했다
- [ ] 조회 결과를 다른 상태 저장소에 복사하지 않았다
