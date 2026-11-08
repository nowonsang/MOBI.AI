# MOBI.AI

Next.js 16 (App Router) + React 19 + TanStack Query v5 + Redux Toolkit v2 · Cloudflare Workers(OpenNext) 배포 · Playwright E2E

## 처음 받았다면 (팀원 온보딩)

자세한 절차와 문제 해결은 `project-setup` 스킬에 있다. Claude Code에 "세팅해줘"라고 하면 이 순서로 안내한다.

1. 프로젝트 소유자에게 Supabase 조직 초대(Developer)와 MOBI.AI 전용 secret 키·프로젝트 URL을 **안전한 경로로** 받는다.
2. `npm install` 후 `npx playwright install chromium` (E2E 테스트 브라우저, 처음 한 번)
3. 루트에 `.env.local` 을 **직접** 만들고 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 를 넣는다 (아래 "환경 변수" 표).
4. `npm run secure:env` — `.env*` 파일 권한을 본인 전용(600)으로 바꾼다 (내용은 읽지 않음).
5. 커밋·push 전 자동 검사 켜기: `chmod +x .githooks/pre-commit .githooks/pre-push && git config core.hooksPath .githooks`
6. `npm run check:supabase` 가 "결과: 통과" 인지 확인한다 (권한이 600이 아니면 실패로 표시된다).

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드
npm run lint       # 코드 규칙 + 아키텍처 규칙(boundaries) 검사
npm run typecheck  # next typegen && tsc
npm run check:supabase  # Supabase 연결·스키마·키 보호 상태 점검 (키 값은 출력하지 않음)
npm run check:migrations  # 마이그레이션 SQL의 mobi_ai 스키마 격리 규칙 검사 (lint에 포함)
npm run secure:env  # .env* 파일 권한을 600으로 (내용은 읽지 않음)
npm run test:e2e    # Playwright E2E — Next 프로덕션 서버 (360·768·1440px)
npm run test:e2e:cf # Playwright E2E — Cloudflare Workers 런타임 (실제 배포 환경)
npm run verify      # lint + typecheck + 위 두 E2E. push 전 필수 (pre-push 훅이 자동 실행)
npm run cf:preview  # Cloudflare Workers 런타임으로 로컬 실행 (http://localhost:8787)
```

Supabase 프로젝트 자체를 처음 준비하는 경우(스키마 생성)는 [Supabase 설정](#supabase-공유-프로젝트)을 따른다.

## 팀 규칙 (Claude Code 스킬)

이 저장소의 규칙은 `.claude/skills/` 에 있고 git으로 공유된다. Claude Code는 작업 내용에 맞는 스킬을 자동으로 불러오며, `/project-architecture` 처럼 직접 호출할 수도 있다. 사람도 같은 문서를 기준으로 리뷰한다.

| 스킬 | 내용 | 사용 시점 |
| --- | --- | --- |
| `project-setup` | 처음 받은 팀원의 환경 설정 순서 (`.env.local`, 권한 600, 커밋 전 검사, 연결 확인) | clone 직후·온보딩·연결 확인 실패 시 |
| `project-architecture` | 계층·의존 방향, 서비스 내부 구조, 네이밍, 상태 책임, 완료 체크리스트 | 모든 코드 작업·리뷰 |
| `add-service` | 새 서비스 생성 절차와 템플릿 | 새 도메인 모듈 추가 |
| `secure-coding` | Server Action·Route Handler·환경 변수·캐시·CSP·의존성 보안 규칙 | 보안 관련 코드 작업·점검 |
| `supabase-schema` | 다른 서비스와 공유하는 프로젝트에서 `mobi_ai` 스키마 격리 규칙, 마이그레이션 작성·검사·실행, 해커톤 종료 정리 | 모든 DB 작업 |
| `ui-design` | 반응형 필수 규칙, 현대자동차 기반 색·비율, 토스식 UX 원칙, 컴포넌트·문구·접근성 규칙 | 모든 화면(UI) 작업 |
| `e2e-testing` | Playwright E2E 작성 규칙, push 전 `npm run verify` 필수 | push 전·테스트 작성·화면/라우트/API 추가 |

규칙은 문서로만 두지 않고 도구로도 강제한다.

| 강제 수단 | 위치 | 동작 |
| --- | --- | --- |
| ESLint `boundaries` | `eslint.config.mjs` | 계층 역방향 import, 서비스 간 import, 계층 밖 파일을 에러로 처리 (IDE·`npm run lint`) |
| ESLint Supabase 격리 | `eslint.config.mjs` | `@supabase/*` 직접 import, `.schema(...)` 스키마 전환을 에러로 처리 |
| ESLint 디자인 토큰 | `eslint.config.mjs` | 임의 색상(`bg-[#...]`, `rgb(...)`, 인라인 `style` 색상)을 에러로 처리 → `globals.css` 토큰만 사용 |
| 마이그레이션 검사 | `scripts/check-migrations.mjs` (`npm run lint` 포함) | 스키마 생략(→ 공유 서비스 `public`에 생성), 공유 스키마 변경, RLS 누락, 위험 구문을 에러로 처리 |
| PostToolUse 훅 | `.claude/hooks/lint-changed-file.mjs` | AI가 파일을 수정할 때마다 ESLint를 돌려 위반을 즉시 AI에게 돌려줌 |
| pre-push 훅 | `.githooks/pre-push` | `npm run verify`(린트·타입·Playwright E2E 2종)가 실패하면 push 차단 |
| 배포 전 비밀 값 검사 | `scripts/check-build-secrets.mjs` (`npm run cf:deploy` 에 포함) | 빌드 결과물에 키·JWT·DB 접속 문자열이 있으면 배포 차단 |
| `AGENTS.md` (`CLAUDE.md`가 import) | 저장소 루트 | 핵심 규칙 요약. 모든 AI 세션에 항상 로드됨 |

규칙을 바꿀 때는 **스킬 문서 + `eslint.config.mjs` + 이 README** 를 함께 수정해 PR로 리뷰한다.

## 폴더 구조

서비스 단위로 나눈다. 서비스 하나 = **라우트 그룹 `app/(서비스)/`** + **도메인 모듈 `features/<서비스>/`** + **API 경로 `app/api/<서비스>/`**.

```
src/
├── app/                              # 라우팅 전용 (얇게 유지: 프리페치 + 조립)
│   ├── layout.tsx                    # 루트 레이아웃, <Providers> 장착
│   ├── (main)/                       # 메인 라우트 그룹 (URL에 포함되지 않음)
│   │   ├── layout.tsx                # 메인 전용 레이아웃
│   │   ├── page.tsx                  # "/" 시작 화면
│   │   └── error.tsx                 # 쿼리 에러 경계 (retry + QueryErrorReset)
│   └── api/<서비스>/...              # 서비스별 BFF Route Handler (브라우저 재요청용)
│
├── core/                             # 앱 전역 인프라 (서비스들을 묶는 계층)
│   ├── providers.tsx                 # StoreProvider + QueryProvider 합성
│   ├── query/
│   │   └── query-provider.tsx        # QueryClient 생성 규칙, Devtools
│   └── store/
│       ├── store.ts                  # makeStore, rootReducer(combineSlices), 타입
│       ├── hooks.ts                  # useAppDispatch / useAppSelector / useAppStore
│       └── store-provider.tsx        # 렌더 트리마다 스토어 1개 생성
│
├── features/                         # 서비스(도메인) 단위 모듈 (아직 비어 있음)
│   └── <서비스>/
│       ├── api/                      # 클라이언트 데이터 계층 (TanStack Query)
│       │   ├── <서비스>.queries.ts   # 캐시 계약: query key + queryOptions
│       │   └── <서비스>.mutations.ts # useMutation 훅 (낙관적 업데이트)
│       ├── model/                    # 타입, Redux 슬라이스, 순수 로직
│       ├── server/                   # 서버 전용 코드 = Data Access Layer
│       │   ├── <서비스>.repository.ts # Supabase(mobi_ai) 접근
│       │   ├── <서비스>.data.ts      # 서버 컴포넌트용 읽기 (권한 확인·DTO)
│       │   └── <서비스>.actions.ts   # 'use server' 쓰기 (zod 검증)
│       └── ui/                       # 서비스 컴포넌트
│
└── shared/                           # 서비스 무관 공용 코드 (features를 import 하지 않음)
    ├── api/http.ts                   # fetch 래퍼, HttpError
    ├── config/server-env.ts          # 서버 환경 변수 zod 검증 + NEXT_PUBLIC_ 키 유출 차단 (server-only)
    ├── supabase/
    │   ├── admin.ts                  # service_role 서버 클라이언트 (server-only, 기본 스키마 mobi_ai)
    │   └── database.types.ts         # mobi_ai 스키마 타입 계약 (migrations SQL과 일치)
    ├── ui/                           # 디자인 시스템 컴포넌트
    └── lib/                          # 유틸 함수

supabase/migrations/                  # DB 스키마 변경 이력 (SQL, 파일 이름 = 실행 순서)
scripts/check-supabase.mjs            # Supabase 연결·키 보호 점검
scripts/check-migrations.mjs          # 마이그레이션 SQL의 mobi_ai 격리 규칙 검사
scripts/check-staged-secrets.mjs      # 커밋 전 비밀 값 검사 (.githooks/pre-commit 에서 실행)
scripts/check-build-secrets.mjs       # 배포 빌드 결과물 비밀 값 검사 (npm run cf:deploy 에서 실행)
e2e/                                  # Playwright E2E 테스트
playwright.config.ts                  # E2E 설정 (360·768·1440px, Next 서버 / Cloudflare 런타임)
wrangler.jsonc, open-next.config.ts   # Cloudflare Workers(OpenNext) 배포 설정
.githooks/pre-commit, pre-push        # 커밋 전 비밀 값 검사, push 전 npm run verify
```

### 의존 방향 (ESLint로 강제)

```
app → core → features → shared
```

- `shared`는 어떤 계층도 import 하지 않는다.
- 서비스끼리 직접 import 하지 않는다 (`features/a` → `features/b` 금지). 공유가 필요하면 `shared`로 올리거나 `app`에서 조립한다.
- 서비스는 core 중 `@/core/store/hooks`(타입 지정 훅)만 import 할 수 있다.
- `src/` 아래 새 최상위 폴더를 만들면 `boundaries/no-unknown-files` 에러가 난다.
- query key·Redux 슬라이스 이름에는 서비스 이름을 접두어로 붙인다 (`["admin", ...]`, `adminRoleFilter`).
- 배럴 파일(`index.ts`)은 두지 않는다. 서버 전용 모듈과 클라이언트 모듈이 한 진입점에 섞이면 번들 경계가 깨진다.

## 디자인 시스템 (상세: `ui-design` 스킬)

현대자동차 공모전 프로젝트라서 **색·비율은 현대자동차 브랜드 실측값**, **UX 행동은 토스식 원칙**을 따른다. 토큰은 `src/app/globals.css` 에 있다.

- **반응형 필수**: 모바일 우선. 360 · 768 · 1024 · 1440px 에서 가로 스크롤 없이 동작해야 한다. 브레이크포인트 `md` 768px, `lg` 1024px (현대 사이트와 동일)
- **색**: `primary` #002C5F(Hyundai Blue, 주 CTA) · `accent` #007FA8(링크) · `highlight` #00AAD2(장식 전용) · `sand` #E4DCD3 · `sand-light` #F6F3F2 · 글자 `ink` 계열 · 선 `line`
- **비율**: 좌우 여백 20 → 24 → 30px, 본문 폭 560 / 1120 / 1400px, 헤더 56 → 64 → 80px, 배너 16:3(모바일 4:3), 카드 이미지 14:17
- **UX**: 한 화면 한 가지 · 주 CTA 1개 · 섹션당 항목 7개 이하 · 0.4초 안에 반응(스켈레톤·낙관적 업데이트) · 실패 화면은 해요체 + 다음 행동 1개
- **글꼴**: Pretendard → 시스템 한글 글꼴. 현대 전용 서체·로고·사진은 공모전 측이 제공·허용한 것만 사용

## 상태 책임 분리

| 상태 종류 | 담당 | 예시 |
| --- | --- | --- |
| 서버 데이터 (초기 렌더) | Server Component → `prefetchQuery` + `dehydrate` | `features/*/server/*.data.ts` |
| 서버 데이터 (브라우저 캐시·재요청·뮤테이션) | TanStack Query | `features/*/api/*` |
| 클라이언트 전역 UI 상태 | Redux Toolkit | 필터, 모달, 다단계 폼, 선택 상태 |
| 공유·북마크 가능한 상태 | URL `searchParams` | 검색어, 페이지 번호 |
| 컴포넌트 로컬 상태 | `useState` | 입력 중 값, 토글 |

**서버에서 온 데이터를 Redux에 복사하지 않는다.** 캐시가 두 군데가 되면 동기화 버그가 생긴다.

## 데이터 흐름 (서비스 공통 패턴)

```
[읽기]  app/(<서비스>)/.../page.tsx (RSC, <Suspense> 안에서)
          └ await connection()    요청 시점 렌더 (서버 캐시 없음)
          └ queryClient.prefetchQuery({ ...<서비스>Queries.<대상>(), queryFn: get*() }) → Supabase mobi_ai.<테이블>
          └ <HydrationBoundary state={dehydrate(queryClient)}>
              └ 클라이언트 컴포넌트   useSuspenseQuery(<서비스>Queries.<대상>())
                                  stale 이후 재요청 → GET /api/<서비스>/...

[쓰기]  클라이언트 컴포넌트 → use<동사><대상>()
          ├ onMutate   낙관적 업데이트 (실패 시 onError에서 롤백)
          ├ mutationFn <동사><대상>Action()  'use server' → zod 검증 → 인증·인가 → repository
          └ onSettled  invalidateQueries → 브라우저 캐시 재동기화
```

실제 코드 예시는 `add-service` 스킬의 `SKILL.md` 와 `templates.md` 에 있다.

## 새 서비스 추가

`add-service` 스킬에 절차와 템플릿이 있다. 요약:

1. `features/<서비스>/` 에 `model` → `server` → `api` → `ui` 순서로 작성
2. Redux 슬라이스가 있으면 `core/store/store.ts` 의 `combineSlices`에 등록
3. `app/api/<서비스>/.../route.ts`, `app/(<서비스>)/layout.tsx`, `app/(<서비스>)/<경로>/page.tsx`
4. `e2e/<서비스>.spec.ts` 테스트 추가 → `npm run verify`

> 라우트 그룹 이름 `(admin)`은 URL에 들어가지 않는다. URL은 그룹 안의 폴더(`admin/`)로 정한다.
> 서로 다른 그룹이 같은 URL을 가지면 빌드 에러가 나므로, `/`는 메인 라우트 그룹(`(main)`)만 사용한다.

## 앱 보안

| 항목 | 위치 | 내용 |
| --- | --- | --- |
| 보안 헤더 | `next.config.ts` | CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, HSTS(production), `X-Powered-By` 제거 |
| 입력 검증 | `features/*/server/*.actions.ts` | Server Action 인자를 zod로 런타임 검증 |
| 환경 변수 | `src/shared/config/server-env.ts` | zod 스키마로 검증, `process.env` 직접 접근 금지. `NEXT_PUBLIC_` 변수에 서버 키가 있으면 서버 시작 자체를 막음 |
| 서버 코드 격리 | `features/*/server/`, `src/shared/supabase/` | `server-only` 로 클라이언트 번들 유입 차단 (DAL) |
| DB 접근 | Supabase `service_role` | 서버에서만 사용, 브라우저는 Supabase에 직접 접속하지 않음 (CSP `connect-src 'self'` 유지) |
| 커밋 전 검사 | `.githooks/pre-commit` → `scripts/check-staged-secrets.mjs` | `.env*`·키 파일, Supabase 키·JWT·프로젝트 URL·DB 접속 문자열·각종 API 토큰이 커밋되면 차단 |

- CSP는 Next.js 공식 "Without Nonces" 정책이다. nonce 기반 CSP는 모든 페이지를 요청마다 동적 렌더링하게 만들어 정적 페이지를 쓸 수 없기 때문이다. 대신 `dangerouslySetInnerHTML` 금지 등 출력 규칙(`secure-coding` 스킬)으로 XSS를 막는다.
- 외부 도메인(이미지 CDN, 분석, API 서버)을 쓰게 되면 CSP 해당 지시어에 그 도메인만 추가한다.
- 인증을 도입하면 Server Action·Route Handler 안에서 매번 인증·인가를 확인한다 (페이지의 검사는 Action을 보호하지 않는다).

### 환경 변수

값은 절대 이 문서에 쓰지 않는다. 이름과 용도만 기록한다.

| 이름 | 범위 | 용도 |
| --- | --- | --- |
| `NODE_ENV` | 서버 | 실행 모드 (Next.js가 설정) |
| `SUPABASE_URL` | 서버 | Supabase 프로젝트 URL (`https://<project-ref>.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 | **MOBI.AI 전용 secret 키**(`sb_secret_...`, Dashboard → API Keys 에서 발급). RLS를 우회하는 관리자 키이므로 절대 `NEXT_PUBLIC_` 를 붙이지 않는다. 변수 이름은 호환을 위해 유지 |
| `SUPABASE_PUBLISHABLE_KEY` | 서버 (현재 미사용) | 공개용 키(`sb_publishable_...`). `mobi_ai` 에는 권한이 없다. 로그인·브라우저 클라이언트를 도입할 때만 사용 |

모든 값은 각자의 `.env.local` 에만 둔다 (gitignore 대상). 파일 권한은 `chmod 600 .env.local` 로 본인만 읽게 한다.

## Supabase (공유 프로젝트)

현재 다른 서비스(이하 '공유 서비스')와 **같은 Supabase 프로젝트**를 쓰고, MOBI.AI의 테이블은 전용 스키마 **`mobi_ai`** 로 분리한다. 공유 서비스는 `public` 스키마를 그대로 쓴다.

### 접근 정책

| 역할 | 누가 쓰는가 | `mobi_ai` 접근 |
| --- | --- | --- |
| `anon` | 공유 서비스 브라우저에 공개된 키 → 사실상 누구나 | 없음 (스키마 USAGE 회수) |
| `authenticated` | 공유 서비스 로그인 사용자 | 없음 (스키마 USAGE 회수) |
| `service_role` | MOBI.AI 서버의 DAL (`features/*/server`) | 테이블별 필요한 권한만 |

- 모든 테이블은 RLS를 켠다. 정책이 없으면 service_role 외에는 행을 볼 수 없다.
- 브라우저에서 직접 읽어야 하는 테이블이 생기면 그 테이블에만 grant + RLS 정책을 추가하고, 위 표를 갱신한다.

### 운영 방침 (해커톤)

- Free 플랜이라 공유 서비스의 Supabase 프로젝트를 함께 쓴다. **API 키·로그인 사용자·스토리지도 공유**하고, DB는 `mobi_ai` 스키마로 분리한다.
- 해커톤 제출 후 MOBI.AI 데이터는 정리한다 (아래 "종료 후 정리").
- 팀원은 Dashboard에 **Developer** 로 초대한다: Supabase 조직 → **Team** → **Invite members**. Developer는 SQL Editor로 공유 서비스 영역까지 수정할 수 있으므로, 분리는 아래 규칙과 자동 검사로 지킨다.

### 처음 설정 (Dashboard에서 1회)

1. **SQL Editor** 에서 `supabase/migrations/` 의 파일을 **이름 순서대로** 모두 실행한다 (각 파일은 여러 번 실행해도 안전).
2. **Project Settings → Data API → Exposed schemas** 에 `mobi_ai` 를 추가하고 저장한다.
3. `npm run check:supabase` 가 "결과: 통과" 인지 확인한다.

### 분리 규칙 (상세: `supabase-schema` 스킬)

| 영역 | 소유 | MOBI.AI에서 |
| --- | --- | --- |
| `mobi_ai` 스키마 | MOBI.AI | 자유롭게 사용 |
| `public` 스키마 | 공유 서비스 | 읽기·쓰기·변경 금지 |
| `auth` (로그인 사용자) | 공유 | `auth.uid()`, `references auth.users(id)` 만. 사용자 정보 수정·auth 트리거 금지 → MOBI 전용 데이터는 `mobi_ai.profiles` 같은 테이블에 |
| Storage | 공유 | `mobi-ai-` 로 시작하는 버킷만 |
| 확장·프로젝트 설정·키 | 공유 서비스 | 변경 금지 |

- 스키마 변경은 `supabase/migrations/<YYYYMMDDHHMMSS>_<설명>.sql` 새 파일로 추가하고 `npm run check:migrations` 를 통과시킨 뒤 SQL Editor에서 실행한다. 이미 실행한 파일은 고치지 않는다.
- **`supabase db push` / `supabase link` 는 쓰지 않는다.** 이 프로젝트의 마이그레이션 이력은 공유 서비스 저장소(GitHub 연동)가 관리한다.
- 마이그레이션을 바꾸면 `src/shared/supabase/database.types.ts` 를 함께 갱신한다.

### 종료 후 정리 (사람이 직접)

1. SQL Editor: `drop schema mobi_ai cascade;` — MOBI.AI 테이블·함수만 삭제되고 공유 서비스에는 영향 없음
2. Project Settings → Data API → Exposed schemas 에서 `mobi_ai` 제거
3. Storage 에서 `mobi-ai-` 버킷 삭제 (공유 로그인 사용자는 공유 서비스 사용자이므로 지우지 않는다)
4. Organization → Team 에서 해커톤 팀원 초대 해제
5. Dashboard → API Keys 에서 **MOBI.AI 전용 secret 키를 삭제**한다. 공유 서비스는 다른 키를 쓰므로 영향이 없다

## AI 민감 파일 보호 (Claude Code 팀 공유 설정)

`.claude/settings.json`과 `.claude/hooks/`는 git에 커밋되어, 이 저장소에서 Claude Code를 쓰는 모든 사람에게 같은 규칙이 적용된다.

| 방어선 | 위치 | 막는 것 |
| --- | --- | --- |
| `permissions.deny` | `.claude/settings.json` | Read/Edit/Write/Grep/Glob 도구로 민감 파일 접근, 보호 설정 파일 수정 |
| PreToolUse 훅 | `.claude/hooks/protect-sensitive-files.mjs` | 위 도구 + **Bash 명령** 전체 검사 |

훅이 Bash에서 막는 것:

- 민감 파일을 가리키는 명령: `cat .env`, `source .env`, `--env-file=.env`, `git show HEAD:.env`, `cat .*`
- gitignore를 무시하고 전체를 훑는 명령: `grep -r`, `rg -u` / `--no-ignore`, `find ... | xargs cat`
- 환경 변수 덤프: `printenv`, `env`, `export -p`, `console.log(process.env)`, `print(os.environ)`, `/proc/*/environ`
- env 파일 직접 로드: `dotenv`, `loadEnvConfig`, `process.loadEnvFile`, `--env-file` (키가 필요한 작업은 `npm run` 스크립트로 실행)
- 보호 설정 변조: `.claude/settings*.json`, `.claude/hooks/**` 에 대한 `rm`·`mv`·`cp`·`sed -i`·리다이렉트 등

차단 대상 파일: `.env*`, `.envrc`, `*.pem`·`*.key`·`*.p12`·`*.pfx`·`*.jks`·`*.keystore`, SSH 개인키(`id_rsa*` 등), `.npmrc`·`.netrc`·`.pgpass`, `credentials(.json)`, `secret(s).*`, 서비스 계정 키 JSON, `secrets/` 디렉터리, `~/.ssh`·`~/.aws`·`~/.gnupg`.

- 훅이 실행되지 못하면(예: node 미설치) 도구 실행을 **차단**한다 (`onFailure: "block"`, fail-closed).
- **보호 설정 파일은 AI가 수정할 수 없다.** 규칙을 바꾸려면 사람이 직접 `.claude/settings.json`·`.claude/hooks/` 를 수정하고 PR 리뷰를 받는다.
- `.env.example`도 차단된다. 환경 변수 목록은 위 "환경 변수" 표에 이름만 기록한다.
- 개인 설정으로 팀 deny 규칙을 풀 수는 없다 (deny가 allow보다 우선).
- 남은 한계: 훅은 명령 문자열을 검사하므로, 의도적으로 난독화한 명령까지 완벽히 막지는 못한다. 운영체제 수준 차단이 필요하면 개인 설정(`.claude/settings.local.json`)에서 Claude Code 샌드박스(`"sandbox": { "enabled": true }`)를 켠다. 단, 샌드박스는 deny 규칙에 따라 `.env` 읽기도 막으므로 AI가 실행하는 `npm run build`/`dev` 가 환경 변수 없이 실행된다. 이 때문에 팀 기본값으로는 켜지 않았다.

## 테스트 (Playwright E2E, 상세: `e2e-testing` 스킬)

- 모든 테스트는 360(모바일) · 768(태블릿) · 1440(데스크톱) px 세 화면 폭에서 실행된다.
- `npm run test:e2e` 는 Next 프로덕션 서버, `npm run test:e2e:cf` 는 **Cloudflare Workers 런타임**(실제 배포 환경)에 대해 실행한다.
- **push 전에는 `npm run verify` 가 통과해야 한다.** pre-push 훅(`.githooks/pre-push`)이 자동으로 실행한다 (활성화는 "처음 받았다면" 5단계).
- 화면·라우트·API 를 추가하면 `e2e/` 에 테스트도 함께 추가한다.

## 배포 (Cloudflare Workers + OpenNext)

Next.js 서버 기능(Server Action, Route Handler, 서버 렌더링)이 있어서 **Cloudflare Pages(정적 출력 폴더)로는 배포할 수 없다.** Cloudflare Workers 에 OpenNext 어댑터로 배포한다.

### Cloudflare 설정 (대시보드에서 1회, 프로젝트 소유자)

1. **Workers & Pages → Create → Import a repository** 로 이 GitHub 저장소를 연결해 **Worker** 를 만든다. 이름은 `wrangler.jsonc` 의 `name` 과 같은 `mobi-ai`.
2. **Settings → Build** 에서:
   - Build command: `npm run cf:build`
   - Deploy command: `npm run cf:deploy` (배포 전 빌드 결과물 비밀 값 검사 포함)
3. **Settings → Variables & Secrets** 에 런타임 값을 **Secret** 타입으로 넣는다: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
4. 예전 **Pages 프로젝트**(`dist` 출력 폴더 오류가 나던 것)는 삭제하거나 Git 연결을 끊는다.

### 규칙

- **로컬에서 배포하지 않는다.** OpenNext 로컬 빌드는 `.env.local` 값을 번들(`.open-next/cloudflare/next-env.mjs`)에 넣는다. `npm run cf:deploy` 는 이런 빌드를 감지하면 배포를 멈춘다. 배포는 Git push → Workers Builds 로만 한다.
- **Cache Components 를 쓰지 않는다** (`cacheComponents`, `'use cache'`). Workers 런타임의 `setTimeout` 구현과 맞지 않아 요청이 멈춘다 (2026-11, OpenNext 1.20.16 에서 확인). 서버 데이터는 TanStack `prefetchQuery` + `dehydrate` 로 넘기고, DB 데이터 페이지는 `await connection()` 으로 요청 시 렌더한다.
- 서버 캐시 저장소(R2 증분 캐시·D1 태그 캐시)는 아직 없다. 필요해지면 Cloudflare 리소스를 만들고 `open-next.config.ts` 에 추가한다.
- Worker 크기 한도: 무료 플랜 3 MiB(gzip). 현재 약 1 MiB.

## 주의할 점 (Next.js 16)

- Server Action을 `mutationFn`에 그대로 넘기지 않는다. TanStack이 넘기는 두 번째 인자(QueryClient 포함)는 직렬화되지 않는다.
- `error.tsx`의 복구 함수는 `reset`이 아니라 `retry`다.
- Next.js API는 학습 데이터와 다를 수 있다. 코드 작성 전 `node_modules/next/dist/docs/`를 확인한다 (AGENTS.md 참고).

## 의존성 보안 메모

- `package.json`의 `overrides`로 `@typescript-eslint/typescript-estree`가 쓰는 `minimatch`를 `^11.0.1`로 고정했다 ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)). upstream이 minimatch 11 이상을 요구하게 되면 이 override는 지워도 된다.
- 같은 방식으로 `@opennextjs/cloudflare` 와 그 하위 `@node-minify/core` 가 쓰는 `glob` 을 `^14.0.4` 로 고정했다 ([GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2)). 빌드 시점 도구라 배포된 서버 코드에는 들어가지 않는다.
