---
name: project-architecture
description: MOBI.AI 팀 공용 클린 아키텍처 규칙. 이 저장소에서 코드를 추가·수정·이동·삭제·리뷰하기 전에 반드시 먼저 로드한다. 폴더 계층(app/core/features/shared), 의존 방향, 서비스 내부 구조(api/model/server/ui), 파일·식별자 네이밍, 상태 책임(Server Component·TanStack Query·Redux·URL), 서버/클라이언트 경계, 캐시 키·태그 규칙, 작업 완료 체크리스트를 정의한다.
---

# MOBI.AI 아키텍처 규칙

팀원 모두와 모든 AI 세션이 같은 규칙으로 코드를 쓰기 위한 기준이다. **규칙과 다른 구조가 필요하면 임의로 바꾸지 말고 사용자에게 먼저 확인한다.**
참고 구현은 `src/features/main` 과 `src/app/(main)` 이다. 새 코드는 이 구현의 모양을 그대로 따른다.

## 1. 계층과 의존 방향 (ESLint `boundaries/dependencies`로 강제)

```
app → core → features → shared
```

| 계층 | 위치 | 책임 | import 가능 대상 |
| --- | --- | --- | --- |
| app | `src/app/` | 라우팅, 서버 데이터 프리페치, feature 컴포넌트 조립. 비즈니스 로직 금지 | core, features, shared |
| core | `src/core/` | 앱 전역 인프라 (Providers, QueryClient, Redux store) | features, shared |
| features | `src/features/<서비스>/` | 서비스(도메인) 로직 전부 | 같은 서비스 내부, shared, `@/core/store/hooks` 만 |
| shared | `src/shared/` | 도메인과 무관한 공용 코드 (http, ui, lib, config) | shared 만 |

- **서비스끼리 import 금지** (`features/a` → `features/b`). 공유할 코드는 도메인을 걷어내고 `shared`로 올리거나, `app`에서 두 서비스를 조립한다.
- `src/` 바로 아래에 새 최상위 폴더를 만들지 않는다 (`boundaries/no-unknown-files` 에러).
- 배럴 파일(`index.ts`)을 만들지 않는다. 서버 전용 모듈과 클라이언트 모듈이 한 진입점에 섞이면 번들 경계가 깨진다. 항상 실제 파일 경로로 import 한다.
- 다른 계층은 `@/` 별칭으로, 같은 서비스 내부는 상대 경로(`../model/...`)로 import 한다.

## 2. 서비스 내부 구조

```
features/<서비스>/
├── model/    순수 타입·Redux 슬라이스·순수 함수. React·fetch·서버 API 금지
├── server/   서버 전용 (Data Access Layer). DB/외부 API 접근, 'use cache' 읽기, 'use server' 쓰기
├── api/      브라우저 데이터 계층. queryOptions(캐시 계약), useMutation 훅
└── ui/       React 컴포넌트
```

서비스 내부 import 방향: `ui → api → model`, `ui → model`, `api → server/*.actions.ts`(뮤테이션만), `server → model`, `server → api/*.queries.ts`(태그 상수만).

- `ui`는 `server/*.repository.ts`, `server/*.data.ts`를 import 하지 않는다 (서버 전용).
- `server/` 의 파일은 첫 줄에 `import "server-only";` 를 둔다. 예외: `*.actions.ts` 는 `"use server";` 로 시작한다.
- `api/*.queries.ts` 는 서버·클라이언트 양쪽에서 쓰는 **캐시 계약** 파일이므로 `server-only`·`client-only` 모듈을 import 하지 않는다.

## 3. 파일·식별자 네이밍

| 대상 | 규칙 | 예 (`main` 서비스) |
| --- | --- | --- |
| 서비스 폴더 | 소문자 kebab-case 단수 | `features/main`, `features/user-profile` |
| 타입 | `model/<서비스>.types.ts` | `MainItem`, `MainItemFilter` |
| Redux 슬라이스 | `model/<서비스>-<주제>.slice.ts`, `name`은 camelCase `<서비스><주제>` | `mainFilterSlice` (`name: "mainFilter"`) |
| 슬라이스 액션 | 과거형 이벤트 이름 | `filterChanged`, `itemSelected` |
| 셀렉터 | `select<대상>` | `selectMainFilter` |
| 캐시 계약 | `api/<서비스>.queries.ts` → `<서비스>Keys`, `<서비스>Tags`, `<서비스>Queries` | `mainKeys.items()`, `mainTags.items`, `mainQueries.items()` |
| 뮤테이션 훅 | `api/<서비스>.mutations.ts` → `use<동사><대상>` | `useToggleMainItem` |
| 저장소(DAL) | `server/<서비스>.repository.ts` → `find*`, `create*`, `update*`, `delete*` | `findMainItems` |
| 캐시 읽기 | `server/<서비스>.data.ts` → `get*` | `getMainItems` |
| Server Action | `server/<서비스>.actions.ts` → `<동사><대상>Action` | `toggleMainItemAction` |
| 컴포넌트 파일 | `ui/<서비스>-<이름>.tsx` (kebab-case), named export PascalCase | `main-item-list.tsx` → `MainItemList` |
| 라우트 | `app/(<서비스>)/...`, API는 `app/api/<서비스>/...` | `app/(main)/page.tsx`, `app/api/main/items/route.ts` |

- `export default` 는 Next.js 특수 파일(`page`, `layout`, `error`, `loading`, `not-found`, `route` 등)에만 쓴다. 나머지는 named export.
- query key는 `["<서비스>", ...]`, cache tag는 `"<서비스>:<대상>"` 로 시작해 서비스 간 캐시 충돌을 막는다.

## 4. 상태 책임

| 상태 | 담당 | 금지 |
| --- | --- | --- |
| 초기 렌더용 서버 데이터 | Server Component + `server/*.data.ts` (`'use cache'` + `cacheTag`) | 클라이언트에서 첫 화면 데이터를 fetch만으로 그리기 |
| 브라우저 서버 데이터 (재요청·뮤테이션·낙관적 업데이트) | TanStack Query (`api/*`) | 서버 데이터를 Redux·useState에 복사 |
| 클라이언트 전역 UI 상태 | Redux Toolkit 슬라이스 | 서버 응답을 슬라이스에 저장 |
| 공유·북마크가 필요한 상태 (검색어, 페이지) | URL `searchParams` | 같은 값을 Redux에 중복 저장 |
| 한 컴포넌트 안의 상태 | `useState` | 불필요한 전역화 |

## 5. 서버/클라이언트 경계와 캐시

- `"use client"` 는 상호작용이 필요한 **말단 컴포넌트**에만 붙인다. 훅 파일(`*.mutations.ts`)과 순수 모듈에는 붙이지 않는다.
- 쿼리를 읽는 클라이언트 컴포넌트(`useSuspenseQuery`/`useQuery`)는 반드시 `<Suspense>` 안에 렌더한다 (Cache Components 프리렌더 제약).
- 서버 → 클라이언트 캐시 전달은 `@/core/query/hydration`의 `createHydrationState` + `<HydrationBoundary>` 만 쓴다. TanStack의 `dehydrate()`를 직접 쓰지 않는다 (프리렌더 중 시각을 읽어 빌드 에러).
- 쓰기는 Server Action에서 하고, 같은 태그를 `updateTag` 로 무효화한다. 클라이언트는 `onMutate`(낙관적) → `onError`(롤백) → `onSettled`(`invalidateQueries`) 순서를 지킨다.
- Server Action을 `mutationFn`에 그대로 넘기지 않는다: `mutationFn: (id: string) => someAction(id)`.
- `error.tsx` 의 복구 함수는 `retry` 이고, `useQueryErrorResetBoundary().reset()` 을 먼저 호출한다.
- Next.js 16 API는 학습 데이터와 다를 수 있다. 처음 쓰는 API는 `node_modules/next/dist/docs/` 에서 확인한다.

## 6. 코드 스타일

- Prettier 기본값: 큰따옴표, 세미콜론, trailing comma.
- 주석은 **왜** 그렇게 했는지만 짧은 한국어로 쓴다. 코드가 말하는 내용을 반복하지 않는다.
- 새 의존성은 꼭 필요할 때만 추가하고, 추가 이유를 사용자에게 알린다.

## 7. 작업 완료 체크리스트

작업을 끝냈다고 보고하기 전에 모두 확인한다. 하나라도 실패하면 고치고 다시 실행한다.

1. `npm run lint` — 아키텍처 위반(`boundaries/*`) 포함 에러 0
2. `npm run typecheck`
3. 구조·라우트·데이터 흐름을 바꿨다면 `npm run build`
4. 폴더 구조나 규칙이 바뀌었다면 `README.md` 를 함께 갱신
5. 보안 관련 코드(Server Action, Route Handler, 환경 변수, 인증)를 건드렸다면 `secure-coding` 스킬의 체크리스트 확인

> 파일을 수정할 때마다 PostToolUse 훅이 ESLint를 돌려 위반을 바로 알려준다. 훅이 위반을 보고하면 다음 작업으로 넘어가기 전에 고친다.

## 8. 자주 하는 실수

- `features/a/ui` 에서 `@/features/b/...` import → 공용 부분을 `shared`로 추출하거나 `app` 에서 조립
- `shared` 에서 서비스 타입 import → `shared` 는 도메인을 몰라야 한다
- 페이지 파일에 fetch·가공 로직 작성 → `server/*.data.ts` 로 옮기고 페이지는 조립만
- query key를 문자열 배열로 하드코딩 → 반드시 `<서비스>Keys` / `<서비스>Queries` 사용
- 서버 응답을 Redux에 저장 → TanStack Query 캐시를 그대로 사용
