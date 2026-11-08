# MOBI.AI

Next.js 16 (App Router · Cache Components) + React 19 + TanStack Query v5 + Redux Toolkit v2

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드
npm run lint       # 코드 규칙 + 아키텍처 규칙(boundaries) 검사
npm run typecheck  # next typegen && tsc
```

## 팀 규칙 (Claude Code 스킬)

이 저장소의 규칙은 `.claude/skills/` 에 있고 git으로 공유된다. Claude Code는 작업 내용에 맞는 스킬을 자동으로 불러오며, `/project-architecture` 처럼 직접 호출할 수도 있다. 사람도 같은 문서를 기준으로 리뷰한다.

| 스킬 | 내용 | 사용 시점 |
| --- | --- | --- |
| `project-architecture` | 계층·의존 방향, 서비스 내부 구조, 네이밍, 상태 책임, 완료 체크리스트 | 모든 코드 작업·리뷰 |
| `add-service` | 새 서비스 생성 절차와 템플릿 | 새 도메인 모듈 추가 |
| `secure-coding` | Server Action·Route Handler·환경 변수·캐시·CSP·의존성 보안 규칙 | 보안 관련 코드 작업·점검 |

규칙은 문서로만 두지 않고 도구로도 강제한다.

| 강제 수단 | 위치 | 동작 |
| --- | --- | --- |
| ESLint `boundaries` | `eslint.config.mjs` | 계층 역방향 import, 서비스 간 import, 계층 밖 파일을 에러로 처리 (IDE·`npm run lint`) |
| PostToolUse 훅 | `.claude/hooks/lint-changed-file.mjs` | AI가 파일을 수정할 때마다 ESLint를 돌려 위반을 즉시 AI에게 돌려줌 |
| `AGENTS.md` (`CLAUDE.md`가 import) | 저장소 루트 | 핵심 규칙 요약. 모든 AI 세션에 항상 로드됨 |

규칙을 바꿀 때는 **스킬 문서 + `eslint.config.mjs` + 이 README** 를 함께 수정해 PR로 리뷰한다.

## 폴더 구조

서비스 단위로 나눈다. 서비스 하나 = **라우트 그룹 `app/(서비스)/`** + **도메인 모듈 `features/<서비스>/`** + **API 경로 `app/api/<서비스>/`**.

```
src/
├── app/                              # 라우팅 전용 (얇게 유지: 프리페치 + 조립)
│   ├── layout.tsx                    # 루트 레이아웃, <Providers> 장착
│   ├── (main)/                       # main 서비스 라우트 그룹 (URL에 포함되지 않음)
│   │   ├── layout.tsx                # main 서비스 전용 레이아웃
│   │   ├── page.tsx                  # "/" — 서버 데이터 → HydrationBoundary → feature UI
│   │   └── error.tsx                 # 쿼리 에러 경계 (retry + QueryErrorReset)
│   └── api/main/items/route.ts       # main 서비스 BFF Route Handler (브라우저 재요청용)
│
├── core/                             # 앱 전역 인프라 (서비스들을 묶는 계층)
│   ├── providers.tsx                 # StoreProvider + QueryProvider 합성
│   ├── query/
│   │   ├── query-provider.tsx        # QueryClient 생성 규칙, Devtools
│   │   └── hydration.ts              # Cache Components용 dehydrate (server-only)
│   └── store/
│       ├── store.ts                  # makeStore, rootReducer(combineSlices), 타입
│       ├── hooks.ts                  # useAppDispatch / useAppSelector / useAppStore
│       └── store-provider.tsx        # 렌더 트리마다 스토어 1개 생성
│
├── features/                         # 서비스(도메인) 단위 모듈
│   └── main/
│       ├── api/                      # 클라이언트 데이터 계층 (TanStack Query)
│       │   ├── main.queries.ts       # 캐시 계약: query key + cache tag + queryOptions
│       │   └── main.mutations.ts     # useMutation 훅 (낙관적 업데이트)
│       ├── model/                    # 타입, Redux 슬라이스, 순수 로직
│       │   ├── main.types.ts
│       │   └── main-filter.slice.ts
│       ├── server/                   # 서버 전용 코드 = Data Access Layer
│       │   ├── main.repository.ts    # 데이터 소스 접근 (DB/외부 API로 교체)
│       │   ├── main.data.ts          # 'use cache' 읽기 함수
│       │   └── main.actions.ts       # 'use server' 쓰기 (zod 검증) + updateTag
│       └── ui/                       # 서비스 컴포넌트
│
└── shared/                           # 서비스 무관 공용 코드 (features를 import 하지 않음)
    ├── api/http.ts                   # fetch 래퍼, HttpError
    ├── config/server-env.ts          # 서버 환경 변수 zod 검증 (server-only)
    ├── ui/                           # 디자인 시스템 컴포넌트
    └── lib/                          # 유틸 함수
```

### 의존 방향 (ESLint로 강제)

```
app → core → features → shared
```

- `shared`는 어떤 계층도 import 하지 않는다.
- 서비스끼리 직접 import 하지 않는다 (`features/a` → `features/b` 금지). 공유가 필요하면 `shared`로 올리거나 `app`에서 조립한다.
- 서비스는 core 중 `@/core/store/hooks`(타입 지정 훅)만 import 할 수 있다.
- `src/` 아래 새 최상위 폴더를 만들면 `boundaries/no-unknown-files` 에러가 난다.
- query key·cache tag·Redux 슬라이스 이름에는 서비스 이름을 접두어로 붙인다 (`["main", ...]`, `"main:items"`, `mainFilter`).
- 배럴 파일(`index.ts`)은 두지 않는다. 서버 전용 모듈과 클라이언트 모듈이 한 진입점에 섞이면 번들 경계가 깨진다.

## 상태 책임 분리

| 상태 종류 | 담당 | 예시 |
| --- | --- | --- |
| 서버 데이터 (초기 렌더) | Server Component + `'use cache'` | `features/*/server/*.data.ts` |
| 서버 데이터 (브라우저 캐시·재요청·뮤테이션) | TanStack Query | `features/*/api/*` |
| 클라이언트 전역 UI 상태 | Redux Toolkit | 필터, 모달, 다단계 폼, 선택 상태 |
| 공유·북마크 가능한 상태 | URL `searchParams` | 검색어, 페이지 번호 |
| 컴포넌트 로컬 상태 | `useState` | 입력 중 값, 토글 |

**서버에서 온 데이터를 Redux에 복사하지 않는다.** 캐시가 두 군데가 되면 동기화 버그가 생긴다.

## 데이터 흐름 (main 서비스 예제)

```
[읽기]  (main)/page.tsx (RSC)
          └ getMainItems()        'use cache' + cacheTag("main:items")
          └ createHydrationState() → <HydrationBoundary>
              └ MainItemList      useSuspenseQuery(mainQueries.items())
                                  stale 이후 재요청 → GET /api/main/items

[쓰기]  MainItemList → useToggleMainItem()
          ├ onMutate   낙관적 업데이트 (실패 시 onError에서 롤백)
          ├ mutationFn toggleMainItemAction()  'use server' → zod 검증 → updateTag("main:items")
          └ onSettled  invalidateQueries → 브라우저 캐시 재동기화
```

## 새 서비스 추가

`add-service` 스킬에 절차와 템플릿이 있다. 요약:

1. `features/<서비스>/` 에 `model` → `server` → `api` → `ui` 순서로 작성
2. Redux 슬라이스가 있으면 `core/store/store.ts` 의 `combineSlices`에 등록
3. `app/api/<서비스>/.../route.ts`, `app/(<서비스>)/layout.tsx`, `app/(<서비스>)/<경로>/page.tsx`
4. `npm run lint && npm run typecheck && npm run build`

> 라우트 그룹 이름 `(admin)`은 URL에 들어가지 않는다. URL은 그룹 안의 폴더(`admin/`)로 정한다.
> 서로 다른 그룹이 같은 URL을 가지면 빌드 에러가 나므로, `/`는 main 서비스만 사용한다.

## 앱 보안

| 항목 | 위치 | 내용 |
| --- | --- | --- |
| 보안 헤더 | `next.config.ts` | CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS(production), `X-Powered-By` 제거 |
| 입력 검증 | `features/*/server/*.actions.ts` | Server Action 인자를 zod로 런타임 검증 |
| 환경 변수 | `src/shared/config/server-env.ts` | zod 스키마로 검증, `process.env` 직접 접근 금지 |
| 서버 코드 격리 | `features/*/server/` | `server-only` 로 클라이언트 번들 유입 차단 (DAL) |

- CSP는 Next.js 공식 "Without Nonces" 정책이다. nonce 기반 CSP는 모든 페이지를 동적 렌더링으로 바꿔 Cache Components(PPR)와 함께 쓸 수 없기 때문이다. 대신 `dangerouslySetInnerHTML` 금지 등 출력 규칙(`secure-coding` 스킬)으로 XSS를 막는다.
- 외부 도메인(이미지 CDN, 분석, API 서버)을 쓰게 되면 CSP 해당 지시어에 그 도메인만 추가한다.
- 인증을 도입하면 Server Action·Route Handler 안에서 매번 인증·인가를 확인한다 (페이지의 검사는 Action을 보호하지 않는다).

### 환경 변수

값은 절대 이 문서에 쓰지 않는다. 이름과 용도만 기록한다.

| 이름 | 범위 | 용도 |
| --- | --- | --- |
| `NODE_ENV` | 서버 | 실행 모드 (Next.js가 설정) |

## AI 민감 파일 보호 (Claude Code 팀 공유 설정)

`.claude/settings.json`과 `.claude/hooks/`는 git에 커밋되어, 이 저장소에서 Claude Code를 쓰는 모든 사람에게 같은 규칙이 적용된다.

| 방어선 | 위치 | 막는 것 |
| --- | --- | --- |
| `permissions.deny` | `.claude/settings.json` | Read/Edit/Write/Grep/Glob 도구로 민감 파일 접근, 보호 설정 파일 수정 |
| PreToolUse 훅 | `.claude/hooks/protect-sensitive-files.mjs` | 위 도구 + **Bash 명령** 전체 검사 |

훅이 Bash에서 막는 것:

- 민감 파일을 가리키는 명령: `cat .env`, `source .env`, `--env-file=.env`, `git show HEAD:.env`, `cat .*`
- gitignore를 무시하고 전체를 훑는 명령: `grep -r`, `rg -u` / `--no-ignore`, `find ... | xargs cat`
- 환경 변수 덤프: `printenv`, `env`, `export -p`
- 보호 설정 변조: `.claude/settings*.json`, `.claude/hooks/**` 에 대한 `rm`·`mv`·`cp`·`sed -i`·리다이렉트 등

차단 대상 파일: `.env*`, `.envrc`, `*.pem`·`*.key`·`*.p12`·`*.pfx`·`*.jks`·`*.keystore`, SSH 개인키(`id_rsa*` 등), `.npmrc`·`.netrc`·`.pgpass`, `credentials(.json)`, `secret(s).*`, 서비스 계정 키 JSON, `secrets/` 디렉터리, `~/.ssh`·`~/.aws`·`~/.gnupg`.

- 훅이 실행되지 못하면(예: node 미설치) 도구 실행을 **차단**한다 (`onFailure: "block"`, fail-closed).
- **보호 설정 파일은 AI가 수정할 수 없다.** 규칙을 바꾸려면 사람이 직접 `.claude/settings.json`·`.claude/hooks/` 를 수정하고 PR 리뷰를 받는다.
- `.env.example`도 차단된다. 환경 변수 목록은 위 "환경 변수" 표에 이름만 기록한다.
- 개인 설정으로 팀 deny 규칙을 풀 수는 없다 (deny가 allow보다 우선).
- 남은 한계: 훅은 명령 문자열을 검사하므로, 의도적으로 난독화한 명령까지 완벽히 막지는 못한다. 운영체제 수준 차단이 필요하면 개인 설정(`.claude/settings.local.json`)에서 Claude Code 샌드박스(`"sandbox": { "enabled": true }`)를 켠다. 단, 샌드박스는 deny 규칙에 따라 `.env` 읽기도 막으므로 AI가 실행하는 `npm run build`/`dev` 가 환경 변수 없이 실행된다. 이 때문에 팀 기본값으로는 켜지 않았다.

## 주의할 점 (Next.js 16 / Cache Components)

- 클라이언트 컴포넌트도 프리렌더된다. `useSuspenseQuery`/`useQuery`로 데이터를 읽는 컴포넌트는 `<Suspense>` 안에 둔다.
- TanStack의 `dehydrate()`는 프리렌더 중 현재 시각을 읽어 빌드 에러를 낸다. `@/core/query/hydration`의 `createHydrationState`를 사용한다.
- Server Action을 `mutationFn`에 그대로 넘기지 않는다. TanStack이 넘기는 두 번째 인자(QueryClient 포함)는 직렬화되지 않는다.
- `error.tsx`의 복구 함수는 `reset`이 아니라 `retry`다.
- Next.js API는 학습 데이터와 다를 수 있다. 코드 작성 전 `node_modules/next/dist/docs/`를 확인한다 (AGENTS.md 참고).

## 의존성 보안 메모

- `package.json`의 `overrides`로 `@typescript-eslint/typescript-estree`가 쓰는 `minimatch`를 `^11.0.1`로 고정했다 ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)). upstream이 minimatch 11 이상을 요구하게 되면 이 override는 지워도 된다.
