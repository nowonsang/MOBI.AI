---
name: secure-coding
description: MOBI.AI 팀 공용 보안 코딩 규칙. Server Action, Route Handler, 인증·인가, 환경 변수·비밀 값, 캐시('use cache'), 외부 요청, 리다이렉트, HTML 렌더링, 의존성 추가, CSP·보안 헤더를 작성하거나 수정·리뷰할 때 반드시 로드한다. 보안 점검이나 감사 요청에도 사용한다.
---

# MOBI.AI 보안 코딩 규칙

Next.js 16 공식 가이드(`node_modules/next/dist/docs/01-app/02-guides/data-security.md`)를 이 프로젝트 구조에 맞춘 규칙이다.
이 프로젝트에서 **`features/<서비스>/server/` 가 Data Access Layer(DAL)** 다. DB·외부 API·비밀 값 접근은 여기서만 한다.

## 1. 비밀 값과 환경 변수

- AI는 `.env*`, 키, 인증서 파일을 읽거나 출력하거나 수정하지 않는다. 훅과 deny 규칙으로 막혀 있으며, **우회를 시도하지 않는다**. 값이 필요하면 사용자에게 변수 이름만 묻는다.
- 서버 환경 변수는 `src/shared/config/server-env.ts` 의 zod 스키마에 추가하고 `serverEnv` 로만 읽는다. 코드 곳곳에서 `process.env` 를 직접 읽지 않는다.
- `NEXT_PUBLIC_` 접두어 변수는 브라우저 번들에 그대로 들어간다. 비밀 값에 절대 붙이지 않는다.
- 비밀 값·토큰·개인정보를 `console.log`, 에러 메시지, 응답 본문에 넣지 않는다.
- 비밀 값을 코드, 테스트 데이터, README, 커밋 메시지에 쓰지 않는다.

## 2. Server Action / Route Handler (공개 엔드포인트)

Server Action은 UI에서 호출하지 않아도 **누구나 직접 POST로 호출할 수 있다**. Route Handler도 마찬가지다.

1. **입력 검증**: 모든 인자를 zod로 `parse` 한다. TypeScript 타입은 런타임 검증이 아니다. URL params·searchParams도 사용자 입력이다.
2. **인증**: Action·Route Handler 안에서 세션을 다시 확인한다. 페이지나 layout의 인증 검사는 Action을 보호하지 않는다.
3. **인가**: 로그인 여부만이 아니라 **그 리소스의 소유자/권한**인지 확인한다 (예: 다른 사람 주문 수정 금지).
4. **최소 반환(DTO)**: DB 레코드를 그대로 반환하지 않는다. 화면에 필요한 필드만 골라 반환한다.
5. **에러**: 내부 정보(스택, SQL, 경로)를 응답에 넣지 않는다. 사용자에게는 일반 메시지, 상세는 서버 로그로.
6. **부수 효과는 렌더링 중에 하지 않는다**: 쓰기는 Server Action/Route Handler에서만.
7. 남용 가능성이 있는 엔드포인트(로그인, 메일 발송, 결제)는 rate limit을 적용한다.

## 3. 캐시와 사용자 데이터

- `'use cache'` 결과는 **모든 사용자가 공유**한다. 로그인 사용자 정보, 권한별로 다른 데이터, `cookies()`·`headers()` 에 의존하는 데이터를 `'use cache'` 로 캐시하지 않는다.
- 요청별 데이터는 캐시하지 않거나 `'use cache: private'` 를 쓴다 (서버 캐시에 저장되지 않음).
- 쓰기 후에는 같은 `cacheTag` 를 `updateTag` 로 무효화한다.

## 4. 서버/클라이언트 경계

- `features/*/server/` 의 읽기·저장소 파일은 `import "server-only";` 로 시작한다 (클라이언트 번들 유입 시 빌드 실패).
- 클라이언트 컴포넌트 props로 비밀 값·내부 ID·전체 레코드를 넘기지 않는다.
- DB 클라이언트·SDK 키를 쓰는 모듈은 `server/` 밖에서 import 하지 않는다.

## 5. Supabase (다른 서비스와 공유하는 프로젝트)

스키마 격리·마이그레이션 규칙은 `supabase-schema` 스킬에 있다. DB 작업 전에 반드시 그 스킬을 로드한다. 보안 관점의 핵심만 여기 둔다.

- `service_role` 키는 RLS를 우회하고 **공유 서비스 DB·로그인 사용자·스토리지 전체**에 대한 관리자 권한을 가진다. 그래서:
  - 서버(`features/*/server` → `@/shared/supabase/admin`)에서만 쓴다. 브라우저용 Supabase 클라이언트를 만들지 않는다 (필요해지면 사용자와 먼저 상의 → 공개용 키 + RLS + CSP `connect-src` 추가).
  - 조회는 필요한 컬럼만 명시하고, Supabase 에러 객체를 그대로 응답에 넣지 않는다 (`error.code` 만 담아 던진다).
- `anon`·`authenticated` 역할은 공유 서비스의 공개 키·로그인 사용자와 공유된다. 이 역할에 `mobi_ai` 권한을 주는 변경은 반드시 사용자 확인을 받는다.
- AI는 원격 DB에 SQL을 실행하지 않는다. 연결 점검은 `npm run check:supabase` 로만 한다 (키 값은 출력되지 않는다).

## 6. 브라우저 보안

- `dangerouslySetInnerHTML` 은 쓰지 않는다. 꼭 필요하면 신뢰할 수 있는 sanitizer를 거친 값만 넣고 사용자에게 알린다.
- 사용자 입력으로 만든 URL로 `redirect()`·`router.push()` 하지 않는다 (open redirect). 허용 목록의 내부 경로만 허용한다.
- 서버에서 사용자 입력 URL로 `fetch` 하지 않는다 (SSRF). 호출 대상 도메인은 코드에 고정한다.
- 보안 헤더와 CSP는 `next.config.ts` 에 있다. 외부 도메인이 필요하면 해당 지시어(`img-src`, `connect-src` 등)에 **그 도메인만** 추가한다. `*` 나 `https:` 같은 와일드카드를 추가하지 않는다.
- 현재 CSP는 Cache Components(PPR)와 호환되도록 `script-src 'unsafe-inline'` 을 허용한다 (nonce CSP는 모든 페이지를 동적 렌더링으로 바꾼다). 그러므로 XSS 방어는 위의 출력 규칙에 의존한다.

## 7. 의존성

- 새 패키지는 꼭 필요할 때만 추가하고, 이유와 함께 사용자에게 알린다. 다운로드 수가 적거나 이름이 유명 패키지와 비슷한 패키지(typosquatting)는 피한다.
- 추가·업데이트 후 `npm audit` 결과가 0건인지 확인한다. `package-lock.json` 을 함께 커밋한다.
- `npm audit fix --force` 는 메이저 다운그레이드를 일으킬 수 있으므로 쓰지 않는다. 필요하면 `package.json` 의 `overrides` 를 쓰고 README "의존성 보안 메모"에 이유를 남긴다.

## 8. AI 작업 보호 장치 (수정 금지)

- `.claude/settings.json`, `.claude/settings.local.json`, `.claude/hooks/**` 는 AI가 수정할 수 없다. 변경이 필요하면 사용자가 직접 수정하고 PR 리뷰를 받는다.
- 훅이 명령을 막으면 다른 명령으로 우회하지 말고, 막힌 이유를 사용자에게 설명한다. 코드 검색은 Grep 도구나 옵션 없는 `rg` 를 쓴다.
- 환경 변수를 통째로 출력하거나(`process.env` 전체, `os.environ`), env 파일을 직접 불러오는(`dotenv`, `loadEnvConfig`) 코드·명령을 만들지 않는다. 키가 필요한 작업은 기존 `npm run` 스크립트를 쓴다.
- 커밋은 `.githooks/pre-commit` 의 비밀 값 검사를 통과해야 한다. `--no-verify` 로 건너뛰지 않는다.

## 9. 보안 체크리스트 (보안 관련 코드를 바꿨을 때)

- [ ] Action/Route Handler 입력을 zod로 검증했다
- [ ] Action/Route Handler 안에서 인증·인가(소유권)를 확인했다
- [ ] 반환값이 필요한 필드만 담은 DTO다
- [ ] 사용자별 데이터를 `'use cache'` 로 캐시하지 않았다
- [ ] 비밀 값이 클라이언트 번들·로그·응답에 들어가지 않는다 (`NEXT_PUBLIC_` 확인)
- [ ] 외부 도메인을 추가했다면 CSP에 그 도메인만 넣었다
- [ ] 마이그레이션을 바꿨다면 `npm run check:migrations` 통과 + `database.types.ts` 갱신 (`supabase-schema` 스킬)
- [ ] `npm audit` 0건, `npm run lint` / `typecheck` / `build` 통과
