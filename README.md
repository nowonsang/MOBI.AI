# MOBI.AI

현대자동차 **Pleos Connect**(Android Automotive 기반 차량 OS) 위에서 도는 차량 앱.
Expo SDK 58 (React Native 0.88, prebuild) + TanStack Query v5 + Redux Toolkit v2 · Kotlin 로컬 모듈로 Pleos Connect SDK 연동 · Jest 단위 테스트

첫 서비스는 **BodyFit AI — 내 몸을 기억하는 운전석**: 체형으로 시트 자세를 추천해 주차 중 자동으로 맞추고, 운전자가 실제로 받아들인 자세와 음성 피드백을 학습해 다음 추천을 개인화한다.

## 처음 받았다면 (팀원 온보딩)

자세한 절차와 문제 해결은 `project-setup` 스킬에 있다. Claude Code에 "세팅해줘"라고 하면 이 순서로 안내한다.

1. 준비물: Node 22.13+ 또는 24.3+, JDK 17, Android Studio(`ANDROID_HOME`), Pleos Playground 계정(My Project). Android Studio 가 없으면 **[ANDROID_SETUP.md](ANDROID_SETUP.md)** 부터.
2. `npm install`
3. `npm run android:doctor` 로 **Pleos Connect 에뮬레이터**가 설치돼 있는지 확인한다. 없으면 출력된 안내대로 Android Studio 에 설치한다 (SDK Update Sites 추가 → 시스템 이미지 API 34 → Automotive, Pleos Connect v2.1.0, **콜드 부트**). 일반 Android 에뮬레이터로는 대신할 수 없다.
4. 루트에 `.env.local` 을 **직접** 만들고 `PLEOS_CLIENT_ID`, `PLEOS_CLIENT_SECRET` 을 넣는다 (없으면 음성 인식·안내는 온디바이스 모드).
5. `npm run secure:env` — `.env*` 파일 권한을 본인 전용(600)으로 바꾼다 (내용은 읽지 않음).
6. 커밋·push 전 자동 검사 켜기: `chmod +x .githooks/pre-commit .githooks/pre-push && git config core.hooksPath .githooks`
7. `npm run android:doctor` 가 "결과: 통과" 인지 확인 → `npm run android:emulator` (Pleos Connect 에뮬레이터를 켜고 빌드·설치·실행)

## 실행

```bash
npm run android:doctor          # Node·JDK·SDK·Pleos Connect 에뮬레이터 점검 (없으면 설치 안내)
npm run android:devices         # 연결된 기기 시리얼·AVD 목록 (Pleos Connect AVD 표시)
npm run android:emulator        # Pleos Connect 에뮬레이터를 켜고 prebuild·빌드·설치·실행 (-- --avd <이름>, -- --variant release, -- --market)
npm run android:device          # 내 기기 prebuild·빌드·설치·실행 (-- --device <시리얼>, -- --market)
npm start              # JS 만 바꿨을 때 개발 서버만 (Fast Refresh)
npm run android:prebuild        # android/ 생성·동기화
npm run android:prebuild:clean  # android/ 를 처음부터 다시 생성 (.env.local·app.config.ts 를 바꾼 뒤)
npm run android:build:debug     # 디버그 APK (-- --arch arm64-v8a)
npm run android:build:release   # 릴리스 APK, 공모전 시연용 contest (배포 키가 없으면 디버그 키 서명 + 경고)
npm run android:build:market    # 릴리스 APK, Pleos 앱 마켓 심사용 market (승인 전 권한·기능 제외)
npm run lint           # ESLint(아키텍처·차량 SDK 창구·디자인 토큰) + 마이그레이션 검사
npm run typecheck
npm test               # Jest 단위 테스트
npm run verify         # 위 4개 전부 — push 전 필수
```

- **Expo Go 는 쓸 수 없다.** Pleos 네이티브 모듈이 있어 항상 개발 빌드를 쓴다.
- `android/` 는 prebuild 생성물(gitignore)이다. 직접 고치지 말고 `app.config.ts`·config plugin 으로 바꾼다.

## Pleos Connect SDK 연동

| 항목 | 값 | 위치 |
| --- | --- | --- |
| Minimum Android SDK | API 28 | `app.config.ts` (`expo-build-properties`) |
| Gradle | 9.4.1 (요구: 8.0 이상) | prebuild 가 생성 |
| 개발 언어 | Kotlin | `modules/pleos-connect/android/` |
| Maven 저장소 | `https://nexus-playground.pleos.ai/repository/maven-releases/` | `app.config.ts` (`extraMavenRepos`) |
| SDK | Vehicle 2.3.2 · NaviHelper 3.0.5 · SpeechToText 3.3.1 · TextToSpeech 3.3.1 (LLM SDK 는 2026-10-19 제공 종료) | `modules/pleos-connect/android/build.gradle` |
| 에뮬레이터 | Pleos Connect Emulator 2.1.0 (API 34) | `project-setup` 스킬 |

선언한 권한(`modules/pleos-connect/android/src/main/AndroidManifest.xml`, 각 SDK 메서드의 `@RequiresPermission` 기준):

| 권한 | 용도 |
| --- | --- |
| `pleos.car.permission.CAR_SEATS` | 시트 위치·지원 범위·착석 여부 읽기 |
| `pleos.car.permission.CONTROL_CAR_SEATS` | 시트 이동 |
| `android.car.permission.CAR_POWERTRAIN` | 기어 상태 (주차 중에만 시트 이동). Pleos Gear API 는 deprecated 라 Android Car API `GEAR_SELECTION` 사용 |
| `pleos.car.permission.STT_SERVICE` / `TTS_SERVICE` | 음성 인식 · 음성 안내 |
| `pleos.car.permission.NAVI_ROUTE` | 목적지 도착 이벤트 (장거리 주행 후 착좌감 질문) |

> Pleos 권한은 Pleos App Market 과 사전 협의·승인된 범위에서만 쓸 수 있다. 쓰지 않는 권한은 넣지 않는다.

JS 에서 쓰는 API (`@/shared/pleos/pleos` 의 `pleos()` 로만 접근):

| 메서드 / 이벤트 | 설명 |
| --- | --- |
| `getGear()` · `onGearChanged` | 현재 기어 (`park`/`drive`/`reverse`/`neutral`/`unknown`) |
| `getDriverSeatState()` | 운전석 축별 현재 값·지원 범위·이동 가능 여부 (앞뒤·높이·등받이·좌판 기울기·좌판 길이·헤드레스트 높이·안전벨트 높이. 차량이 지원하는 축만) |
| `moveDriverSeatAxis(axis, target)` | 목표 위치까지 이동. **기어 P 에서만**, 이동 중에도 기어를 확인하고, 끝나면 항상 멈춤 |
| `stopDriverSeat()` | 즉시 멈춤 |
| `isDriverSeatOccupied()` · `onDriverSeatOccupancyChanged` | 운전석 착석 여부 |
| `onDriverSeatPositionChanged` | 운전석 축별 위치 변경 알림 (가이드 조절, 운전자가 시트 버튼을 누를 때도 옴) |
| `listen()` · `onSpeechPartial` · `stopListening()` | 한 문장 음성 인식 (한국어) |
| `speak(text)` | 음성 안내 |
| `onDestinationArrived` | 내비게이션 목적지 도착 |

## Pleos Playground (상세: `project-setup`·`testing` 스킬)

- **프로젝트**: [developers.pleos.ai](https://developers.pleos.ai) → Workspace → My Project → 프로젝트 생성 (프로젝트 이름, 개발사명, 카테고리, 설명). 카테고리는 기획 단계에서 정한다 (후보: Lifestyle).
- **키**: 프로젝트 ID(Key) = 앱 심사 제출 때 "SDK 추가 권한"에 입력. SDK 클라이언트 ID·시크릿 = 서버 연결 SDK(STT·TTS)용 → `.env.local`.
- **SDK 사용 상태 (2026-11 기준)**: Vehicle State·NaviHelper 는 신청 없이 사용. **Vehicle Control(시트 이동)·SpeechToText·TextToSpeech 는 "준비 중"** 이라 아직 신청할 수 없다 → 에뮬레이터 개발은 가능하지만 배포 전 사용 승인을 다시 확인한다.
- **종료된 것**: LLM SDK, CRN(Emulator 2.1.0 부터 주입 불필요), 블루투스 동글 연동 (2026-10-19).
- **앱에 넣은 Pleos 필수 설정**: `com.hmg.rotary.ROTARY_SUPPORTED=false` (CCP 미지원 앱, `app.plugin.js`), `allowBackup=false` (보안 가이드), `versionCode` (심사·배포마다 올림, `app.config.ts`), minSdk 28 (서명 키 로테이션·리니지).
- **빌드 종류 (`MOBI_APP_VARIANT`)**: `contest`(기본, 공모전 시연: 시트 자동 조절·음성 포함) / `market`(앱 마켓 심사: 승인 전 권한 `CONTROL_CAR_SEATS`·`CONTROL_CAR_CLIMATE`·`STT_SERVICE`·`TTS_SERVICE` 를 매니페스트에서 `tools:node="remove"` 로 빼고, 화면에서도 자동 조절·온도 맞추기·음성을 숨긴다). Pleos 심사는 "승인되지 않은 퍼미션을 선언하거나 해당 API 를 호출"하면 통과할 수 없다. 권한이 승인되면 `app.plugin.js` 의 `UNAPPROVED_PERMISSIONS` 와 `src/shared/config/app-variant.ts` 에서 뺀다.
- **제출 전 남은 일**: 배포 키로 서명한 **APK**(아래 'APK 서명'), 아이콘 512×512 PNG/JPEG(1MB 이하), IVI 스크린샷 2~8장, 개인정보처리방침 URL, IARC 연령 등급, 영어 앱 이름 태그.
- 앱 마켓은 자동 업데이트를 지원하지 않는다. 업데이트 안내가 필요하면 `market://detail?package=ai.mobi.app` 로 연결한다.

## BodyFit AI 흐름

1. **운전자 등록**: 이름·키·몸무게(+ 선택: 앉은키). 체형 정보는 기기 안에만 저장한다.
2. **체형 기반 추천**: 키가 클수록 뒤로, 상체가 길수록 낮게, 체중이 많이 실리면 조금 높게 (`model/bodyfit-recommend.ts`). 차종마다 원시 값 단위가 달라 모든 값은 축 범위 안의 비율(0~1)로 다룬다.
3. **주차 중 자동 조절**: 확인 대화상자 → 축마다 순서대로 이동. 움직이는 동안 "멈추기".
4. **개인 학습**: 주행을 시작하는 순간(P → D)의 자세, "지금 자세 기억하기", 음성 피드백 조절 결과를 기록하고, 체형 추천과의 차이를 최근 기록에 가중치를 두어 평균 내 다음 추천에 더한다 (`model/bodyfit-learning.ts`).
5. **음성 피드백**: "페달이 멀어", "등받이 조금 눕혀" → 방향이 분명한 표현을 규칙으로 조절안으로 바꾸고, **운전자가 확인해야** 움직인다. (Pleos LLM SDK 는 제공 종료. 자유로운 문장 이해가 필요하면 Gleo Interface 연동을 검토한다)
6. **장거리 주행 후 질문**: 1시간 이상 주행 후 주차하거나 목적지에 도착하면 "운전 자세는 편하셨나요?"를 음성으로 묻는다.

지금 범위에서 뺀 것: 카메라 체형 분석(차량 실내 카메라 접근 API 미확인, 몸무게는 카메라로 잴 수 없음), 체중 센서(Pleos SDK 에는 착석 여부만 있음), 스티어링 휠 위치.

## 팀 규칙 (Claude Code 스킬)

| 스킬 | 언제 |
| --- | --- |
| `project-setup` | 처음 clone, Pleos Connect 에뮬레이터 설치·실행(앱을 빌드해서 띄우기), `.env.local` 설정, 빌드 실패 |
| `project-architecture` | 코드를 추가·수정·이동·리뷰하기 전 (네이티브 모듈 포함) |
| `add-service` | 새 서비스(도메인) 추가 |
| `secure-coding` | 차량 제어, Pleos 권한·등록 정보, 비밀 값, 개인정보, 음성 입력, 의존성 |
| `supabase-schema` | DB 작업 (지금 앱은 DB 를 쓰지 않음) |
| `ui-design` | 화면·컴포넌트·문구 |
| `redux-toolkit` | Redux 상태(슬라이스·액션·셀렉터·스토어) 작성·변경 (Redux 아키텍처) |
| `react-query` | 비동기 데이터(query key·queryOptions·useQuery·useMutation·캐시 무효화) |
| `testing` | push 전, 테스트 작성, `model`·네이티브·설정 변경 |

## 폴더 구조

```
app.config.ts                 Expo 설정 (Android 전용, minSdk 28, Pleos Maven 저장소, config plugin)
modules/pleos-connect/        Pleos Connect SDK 로컬 Expo 모듈
├── app.plugin.js             .env.local 의 Pleos 앱 등록 정보 → 매니페스트 meta-data, market 빌드의 승인 전 권한 제거
├── android/build.gradle      Pleos SDK 의존성
├── android/src/main/AndroidManifest.xml   Pleos 권한
├── android/src/main/java/ai/mobi/pleosconnect/
│   ├── PleosConnectModule.kt JS 로 노출하는 함수·이벤트
│   ├── DriverSeat.kt         시트 읽기·목표 위치 이동(주차 확인·항상 STOP)
│   ├── GearMonitor.kt        Android Car API GEAR_SELECTION
│   ├── UxRestrictionsMonitor.kt  플랫폼 주행 중 UX 제한 (CarUxRestrictions, NO_SETUP)
│   ├── VoiceServices.kt      STT · TTS
│   ├── NaviEvents.kt         목적지 도착 이벤트
│   └── PleosErrors.kt        JS 에러 코드
└── src/                      JS 계약 (PleosConnect.types.ts, PleosConnectModule.ts)
src/
├── app/                      Expo Router 라우트 (조립만)
│   ├── _layout.tsx           Providers + Stack
│   ├── index.tsx             → /bodyfit
│   └── (bodyfit)/            _layout.tsx (주행 감시), bodyfit/index · new · [profileId]/index · [profileId]/guide
├── core/                     Providers, Redux store
├── features/bodyfit/         참고 구현 서비스
│   ├── model/                타입·zod 스키마·추천·학습·음성 해석·세션 슬라이스 (+ *.test.ts)
│   ├── api/                  기기 저장소, 캐시 계약, 뮤테이션, 음성 묶음
│   └── ui/                   화면(*-screen.tsx: 운전자 목록·등록·맞춤 자세·가이드 조절·주행 후 피드백), 운전석 그림·축 막대, 음성 피드백, 주행 감시
└── shared/
    ├── pleos/                차량 SDK 접근 창구 (pleos.ts, pleos.types.ts, use-gear, use-ux-restrictions, use-pleos-event)
    ├── storage/              기기 저장 값 암호화 (encrypted-storage.ts)
    ├── config/               빌드 종류별 기능 (app-variant.ts: contest/market)
    └── ui/                   디자인 토큰(theme.ts)과 공용 컴포넌트(Screen, Columns, Card, InfoRow, IconBadge, Chip, Button, TextField, StatusView)
scripts/                      개발 도구 (비밀 검사, env 권한, 마이그레이션 검사, Supabase 점검)
scripts/android/              Android 스크립트 (점검·기기 목록·prebuild·빌드·에뮬레이터·실기기 실행, 공용 lib.mjs)
ANDROID_SETUP.md              Android Studio 설치부터 실행까지 매뉴얼
supabase/migrations/          공유 Supabase 의 mobi_ai 스키마 변경 이력
```

### 의존 방향 (ESLint로 강제)

```
app → core → features → shared → native(modules/*)
```

- 서비스끼리 import 금지, features 는 core 중 `@/core/store/hooks` 만.
- 네이티브 모듈은 `src/shared/pleos/*` 만 import 한다. `model` 과 테스트는 네이티브를 부르지 않는 `pleos.types.ts` 만 쓴다.
- 색은 `src/shared/ui/theme.ts` 토큰만 (임의 색상은 ESLint 에러).

## 상태 책임

| 상태 | 담당 |
| --- | --- |
| 기기 저장소·차량 값 (비동기로 읽는 데이터) | TanStack Query (`api/*.queries.ts`) |
| 저장·차량 제어 | `useMutation` (`api/*.mutations.ts`) |
| 현재 운전자, 확인 대기 중인 조절안 | Redux (`bodyfit-session.slice.ts`) |
| 진행 중인 주행 (누가 언제 출발했는지) | 기기 저장소 (`useStartDriveSession`·`useEndDriveSession`). 주행 중 차량이 앱을 종료해도 남아야 한다 |
| 어떤 운전자 화면인지 | 라우트 파라미터 `[profileId]` |
| 기어·착석·도착 | 차량 이벤트 (`usePleosEvent`, `useGear`) |

## 보안·안전 (상세: `secure-coding` 스킬)

- 차량을 움직이는 동작은 **기어 P 에서만**, 운전자 확인 후에만, 끝나면 **항상 STOP**. 기어를 알 수 없으면 주차가 아닌 것으로 본다.
- 음성 인식 결과는 신뢰하지 않는 입력이다. 조절안으로만 만들고 운전자 확인 후에만 적용한다.
- 체형·자세 기록은 기기 안에만 **AES-GCM 으로 암호화**해 저장한다 (`src/shared/storage/encrypted-storage.ts`, 키는 `expo-secure-store` 로 Android Keystore 가 보호). 운전자가 지울 수 있다.
- 운전자 등록 화면에서 수집 항목·목적·보관·거부 권리를 알리고 **"동의하고 등록하기"** 버튼으로만 필수 동의를 받는다. 음성 기능은 별도 선택 동의(음성은 Pleos 서버에서 처리될 수 있음)이며, 동의한 운전자에게만 마이크를 연다.
- `EXPO_PUBLIC_*` 변수와 앱 설정 값은 APK 에 들어간다. 비밀 값을 넣지 않는다.

### 환경 변수 (`.env.local`, 이름만 기록)

| 이름 | 용도 | 들어가는 곳 |
| --- | --- | --- |
| `PLEOS_CLIENT_ID` | Pleos Playground > My Project > SDK 클라이언트 ID (서버 모드 STT·TTS) | 생성된 `android/` 매니페스트 meta-data (빌드된 APK 에서는 추출 가능) |
| `PLEOS_CLIENT_SECRET` | 위와 같음 | 위와 같음 |
| `SUPABASE_URL` 등 | `npm run check:supabase` 전용. 앱에서는 쓰지 않음 | — |

## Supabase (공유 프로젝트)

다른 서비스(이하 '공유 서비스')와 **같은 Supabase 프로젝트**를 쓰고, MOBI.AI 객체는 전용 스키마 **`mobi_ai`** 에 둔다 (상세: `supabase-schema` 스킬).

- **지금 앱은 DB 를 쓰지 않는다.** 앱 번들에 넣은 키는 누구나 꺼낼 수 있고, 이 프로젝트의 키는 실서비스와 공유되기 때문이다. `@supabase/*` import 는 ESLint 에러다. DB 가 필요해지면 키를 서버에만 두는 백엔드 구조를 먼저 정한다.
- 스키마 변경은 `supabase/migrations/<YYYYMMDDHHMMSS>_<설명>.sql` 새 파일 → `npm run check:migrations` → SQL Editor 에서 사람이 실행. **`supabase db push` / `supabase link` 는 쓰지 않는다.**
- 해커톤 종료 후 정리 절차(`drop schema mobi_ai cascade` 등)는 `supabase-schema` 스킬 6장.

## AI 민감 파일 보호 (Claude Code 팀 공유 설정)

`.claude/settings.json`과 `.claude/hooks/`는 git에 커밋되어, 이 저장소에서 Claude Code를 쓰는 모든 사람에게 같은 규칙이 적용된다.

| 방어선 | 위치 | 막는 것 |
| --- | --- | --- |
| `permissions.deny` | `.claude/settings.json` | Read/Edit/Write 도구로 민감 파일 접근, 보호 설정 파일 수정 |
| PreToolUse 훅 | `.claude/hooks/protect-sensitive-files.mjs` | 위 도구 + **Bash 명령** 전체 검사 (민감 파일 참조, `grep -r` 같은 전체 훑기, 환경 변수 덤프, 보호 설정 변조) |
| PostToolUse 훅 | `.claude/hooks/lint-changed-file.mjs` | AI 가 고친 파일을 즉시 ESLint 로 검사 |

- 차단 대상 파일: `.env*`, `.envrc`, `*.pem`·`*.key`·`*.p12`·`*.pfx`·`*.jks`·`*.keystore`, SSH 개인키, `.npmrc`·`.netrc`·`.pgpass`, `credentials(.json)`, `secret(s).*`, 서비스 계정 키 JSON, `secrets/`, `~/.ssh`·`~/.aws`·`~/.gnupg`.
- 훅이 실행되지 못하면 도구 실행을 **차단**한다 (fail-closed). **보호 설정 파일은 AI가 수정할 수 없다.** 규칙을 바꾸려면 사람이 직접 수정하고 PR 리뷰를 받는다.
- 남은 한계: 훅은 명령 문자열을 검사하므로 의도적으로 난독화한 명령까지 완벽히 막지는 못한다.

## 테스트 (상세: `testing` 스킬)

- `npm test`: `model` 의 순수 로직(추천·학습·비율 변환·음성 규칙 해석) 단위 테스트.
- `npm run android:build:debug`: Kotlin 컴파일과 Pleos SDK 의존성 해석까지 확인한다 (`verify` 는 arm64-v8a 만 빌드).
- 차량 동작(시트 이동·멈춤·기어 전환·음성)은 Pleos Connect 에뮬레이터에서 수동 확인하고 결과를 커밋 메시지에 적는다.
- **push 전에는 `npm run verify` 가 통과해야 한다.** pre-push 훅이 자동으로 실행한다.
- **PR 은 만들지 않는다.** 브랜치에서 작업하고 `verify` 를 통과하면 `master` 에 fast-forward 로 바로 머지·push 한 뒤, 그 브랜치를 원격·로컬에서 바로 지운다. `master` 와 머지 전 브랜치는 지우지 않는다 (`testing` 스킬 1-1).
- **동시 작업은 세션마다 별도 worktree.** 한 폴더는 한 세션만 쓴다. 여러 세션이 함께 작업하면 각자 저장소 밖 `../MOBI.AI-worktrees/<브랜치>` 에 `git worktree add` 로 폴더를 만들어 작업하고, 머지 직후 지운다. 에뮬레이터 실행(`android:emulator`)은 한 번에 한 세션만 (`testing` 스킬 1-2).

## 의존성 보안 메모

- 2026-11-09 기준 `npm audit` 의 moderate 31건·low 1건은 모두 개발·빌드 도구(Expo CLI, Jest, ESLint)가 쓰는 `glob`([GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4))·`minimatch`([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249))·`deepmerge`([GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4))에서 나온다. 앱(APK)에 들어가는 코드가 아니다.
- `overrides` 로 강제 업그레이드하면 Expo CLI·Metro 와 어긋날 수 있어 지금은 두지 않았다. Expo SDK 패치 버전이 올라오면 `npx expo install --fix` 후 다시 확인한다. `npm audit fix --force` 는 쓰지 않는다.

## APK 서명

Pleos 앱 보안 가이드: 배포용 앱은 디버그 인증서가 아닌 **배포용 인증서**로 서명한다 (minSdk 28 → v2·v3 서명, 키 로테이션).

1. 배포 키를 한 번 만든다. 저장소 밖에 둔다 (예: `~/keys/` 폴더): `keytool -genkeypair -v -keystore <키 파일 경로> -alias mobi -keyalg RSA -keysize 2048 -validity 10000`
2. 키 위치·비밀번호를 **`~/.gradle/gradle.properties`(저장소 밖)** 에 적는다. 이름만 기록: `MOBI_UPLOAD_STORE_FILE`, `MOBI_UPLOAD_STORE_PASSWORD`, `MOBI_UPLOAD_KEY_ALIAS`, `MOBI_UPLOAD_KEY_PASSWORD` (또는 같은 이름 앞에 `ORG_GRADLE_PROJECT_` 를 붙인 환경 변수).
3. `npm run android:build:release` (또는 `android:build:market`). 속성이 없으면 디버그 키로 서명되고 스크립트가 경고한다.

`app.config.ts` 의 `withReleaseSigning` 은 생성된 `android/app/build.gradle` 에 이 속성을 읽는 서명 설정만 넣는다. 키 파일·비밀번호는 저장소와 `android/` 어디에도 기록되지 않는다. **키를 잃어버리면 같은 앱으로 업데이트할 수 없으니** 팀에서 안전하게 보관한다.

## 배포

아직 정하지 않았다. Pleos App Market 등록 절차(권한 승인, 서명)는 정해지면 이 절에 추가한다. 이전 웹 버전의 Cloudflare Workers 배포는 2026-11-09 Expo 전환과 함께 제거했다 (Workers Builds 연동이 남아 있다면 Cloudflare 대시보드에서 끊는다).
