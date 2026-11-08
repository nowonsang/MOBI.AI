---
name: e2e-testing
description: MOBI.AI 자동화 테스트(Playwright E2E) 규칙과 push 전 검증 절차. git push, 커밋 후 원격 반영, 배포 전 확인, 테스트 작성·수정, 화면·라우트·API 를 추가하거나 바꿀 때 반드시 로드한다. npm run verify 로 린트·타입·E2E(Next 서버와 Cloudflare Workers 런타임)를 통과한 뒤에만 push 한다.
---

# E2E 테스트와 push 전 검증

## 1. push 규칙 (AI 필수)

1. **push 하기 전에 반드시 `npm run verify` 를 실행하고, 전부 통과했을 때만 push 한다.**
   - `verify` = `lint` → `typecheck` → `test:e2e`(Next 프로덕션 서버) → `test:e2e:cf`(Cloudflare Workers 런타임)
2. 실패하면 push 하지 않고, 원인을 고친 뒤 다시 `verify` 를 돌린다. 테스트를 지우거나 `skip` 해서 통과시키지 않는다.
3. `git push --no-verify` 로 pre-push 훅을 건너뛰지 않는다.
4. 사용자에게 보고할 때 통과한 테스트 수를 함께 알린다.

`.githooks/pre-push` 가 같은 검사를 자동으로 돌린다 (활성화는 `project-setup` 스킬 4단계).

## 2. 실행 방법

| 명령 | 대상 | 용도 |
| --- | --- | --- |
| `npm run test:e2e` | `next build` + `next start` (포트 3100) | 빠른 확인 |
| `npm run test:e2e:cf` | OpenNext 빌드 + Workers 로컬 런타임 (포트 8787) | **실제 배포 환경과 같은 런타임** |
| `npm run verify` | 린트 + 타입 + 위 두 가지 | push 전 필수 |
| `npx playwright test e2e/home.spec.ts --project=mobile-360` | 특정 파일·화면 폭만 | 디버깅 |

- 처음 한 번 브라우저 설치: `npx playwright install chromium`
- 이미 같은 포트로 서버가 떠 있으면 그 서버를 재사용한다. 코드를 바꿨는데 결과가 이상하면 떠 있는 서버(`next start`, `wrangler dev`)를 끄고 다시 실행한다.
- 실패한 테스트는 `test-results/` 에 trace 가 남는다: `npx playwright show-trace <trace.zip>`

## 3. 테스트 작성 규칙

- 위치: `e2e/<화면 또는 기능>.spec.ts`. 화면·라우트·API 를 추가하면 **같은 작업에서** 테스트도 추가한다.
- 모든 테스트는 `mobile-360` · `tablet-768` · `desktop-1440` 세 프로젝트에서 실행된다 (반응형 필수 규칙, `ui-design` 스킬). 화면 폭에 따라 다른 동작은 `page.viewportSize()` 로 분기해 검증한다.
- 요소는 사용자 관점으로 찾는다: `getByRole` → `getByLabel` → `getByText` 순서. CSS 클래스·`nth-child` 선택자에 의존하지 않는다.
- 고정 대기(`waitForTimeout`)를 쓰지 않는다. `expect(...).toBeVisible()` 처럼 자동 재시도되는 단언을 쓴다.
- 각 화면마다 최소한 확인할 것:
  1. 주요 내용이 보인다 (제목, 주 CTA)
  2. 가로 스크롤이 없다
  3. 콘솔 에러가 없다 (CSP 위반 포함)
  4. 로딩·실패·빈 상태가 규칙대로 나온다 (`ui-design` 스킬 6장)
- **테스트에 실제 비밀 값·개인정보를 쓰지 않는다.** 공유 Supabase(운영 중인 공유 서비스 데이터 포함)에 쓰기를 하는 테스트를 만들지 않는다. 데이터 쓰기 흐름은 `page.route()` 로 네트워크를 가로채 가짜 응답으로 검증하거나, 사용자와 테스트 전용 데이터 방침을 먼저 정한다.
- 테스트가 공유 서비스의 `public` 스키마나 로그인 사용자 데이터를 읽거나 바꾸면 안 된다 (`supabase-schema` 스킬).

## 4. 실패했을 때

1. 실패한 프로젝트(화면 폭)와 테스트 이름을 확인한다.
2. `test:e2e` 는 통과하고 `test:e2e:cf` 만 실패하면 Cloudflare Workers 런타임 차이다. 로컬 Workers 로그는 `http://localhost:8787/cdn-cgi/local/explorer/api/local/observability/query` 로 조회할 수 있다 (`wrangler dev` 실행 중일 때).
3. Cache Components(`'use cache'`, `cacheComponents`)를 다시 켜면 Workers 에서 요청이 멈춘다. 쓰지 않는다 (`project-architecture` 스킬 5장).
