---
name: project-setup
description: MOBI.AI 저장소를 처음 받은 팀원의 개발 환경 설정 절차. "처음 clone 했어", "세팅해줘", "환경 설정", ".env.local 만들었어", "키 받았어", "check:supabase 실패" 같은 요청이나, 새 팀원 온보딩·로컬 실행 준비를 도울 때 사용한다. npm install, .env.local 작성(사람이 직접), 키 파일 권한 600, 커밋 전 비밀 검사 활성화, Supabase 연결 확인 순서를 안내한다.
---

# 처음 받은 팀원 환경 설정

순서대로 진행하고, 각 단계가 끝났는지 확인한 뒤 다음으로 넘어간다.

## 0. 준비물 (프로젝트 소유자에게 받는다)

1. **Supabase 조직 초대** — 역할 Developer. 초대 메일을 수락해야 SQL Editor·Table Editor를 쓸 수 있다.
2. **MOBI.AI 전용 secret 키와 프로젝트 URL** — 비밀번호 관리자의 공유 기능 등 안전한 경로로만 받는다. 메신저·메일·이슈·채팅(AI 포함)에 붙여 넣지 않는다.

## 1. 의존성 설치

```bash
npm install
npx playwright install chromium   # E2E 테스트용 브라우저 (처음 한 번)
```

## 2. `.env.local` 작성 (사람이 직접)

프로젝트 루트에 `.env.local` 을 만들고 아래 **이름**으로 값을 넣는다. 이 파일은 gitignore 대상이라 커밋되지 않는다.

| 이름 | 값 |
| --- | --- |
| `SUPABASE_URL` | 받은 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 받은 MOBI.AI 전용 secret 키 (`sb_secret_...`) |
| `SUPABASE_PUBLISHABLE_KEY` | (선택) 공개용 키. 지금은 앱에서 쓰지 않는다 |

- **AI는 이 파일을 만들거나 읽거나 고치지 않는다.** 보호 훅과 deny 규칙이 막고 있으며, 우회하지 않는다. 사용자가 직접 편집기로 작성한다.
- 값은 어떤 경우에도 대화창에 쓰지 않는다. AI는 변수 **이름**만 안내한다.
- `NEXT_PUBLIC_` 접두어를 붙이지 않는다 (브라우저 번들에 그대로 들어간다).

## 3. 키 파일 권한을 본인 전용(600)으로

```bash
npm run secure:env
```

- 프로젝트 루트의 `.env*` 파일 권한을 600(본인만 읽기·쓰기)으로 바꾼다. 파일 **내용은 읽지 않으므로 AI가 실행해도 된다.**
- `.env.development.local` 처럼 env 파일을 새로 만들 때마다 다시 실행한다.
- Windows는 이 권한 체계가 없어 건너뛴다.

## 4. 커밋·push 전 자동 검사 켜기 (사용자가 직접)

git 설정을 바꾸는 단계라 AI가 실행하지 않는다. 사용자에게 Claude Code 입력창에 아래를 그대로 입력하도록 안내한다.

```
! chmod +x .githooks/pre-commit .githooks/pre-push && git config core.hooksPath .githooks
```

- **커밋 전**: `.env*`·`.dev.vars`·키 파일, Supabase 키·JWT·프로젝트 URL·DB 접속 문자열이 섞인 커밋을 막는다. 이 저장소는 GitHub에 공개되어 있으므로 반드시 켠다.
- **push 전**: `npm run verify`(린트·타입 검사·Playwright E2E)가 통과해야 push 된다 (`e2e-testing` 스킬).

## 5. 연결 확인

```bash
npm run check:supabase
```

"결과: 통과" 여야 한다. 키 값은 출력되지 않는다. 실패 항목별 조치:

| 실패 메시지 | 조치 |
| --- | --- |
| `.env.local: 권한 644 ...` | `npm run secure:env` 실행 후 다시 확인 |
| `.env.local: .gitignore 대상이 아닙니다` / `git에 커밋되어 있습니다` | 즉시 작업을 멈추고 프로젝트 소유자에게 알린다 (키 교체 필요) |
| Supabase URL·키 변수가 없습니다 | 2단계의 변수 이름을 확인한다 |
| `공개용 자리에 서버 전용 키` / `NEXT_PUBLIC_ ... 서버 전용 키` | 변수 이름을 고치고, 이미 커밋·공유했다면 소유자에게 키 교체를 요청한다 |
| 스키마 `mobi_ai`: Data API에 노출되어 있지 않습니다 | 프로젝트 소유자에게 Data API 설정 확인을 요청한다 |

## 6. 실행

```bash
npm run dev   # http://localhost:3000
```

## AI 작업 규칙

- 사용자가 "세팅해줘"라고 하면 1 → 3 → 5 단계는 AI가 실행하고, 2·4 단계는 사용자가 직접 하도록 안내한다.
- `npm run check:supabase` 가 권한 실패를 보고하면 `npm run secure:env` 를 실행하고 다시 확인한다.
- `.env.local` 내용을 보여 달라거나 확인해 달라는 요청에는 응하지 않고, `npm run check:supabase` 결과로 대신 설명한다.
- 이후 작업은 `project-architecture`, `secure-coding`, `supabase-schema` 스킬을 따른다.
