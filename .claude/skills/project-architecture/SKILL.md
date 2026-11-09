---
name: project-architecture
description: MOBI.AI 팀 공용 클린 아키텍처 규칙 (Expo/React Native + Pleos Connect 차량 앱). 이 저장소에서 코드를 추가·수정·이동·삭제·리뷰하기 전에 반드시 먼저 로드한다. 폴더 계층(app/core/features/shared/native 모듈), 의존 방향, 서비스 내부 구조(model/api/ui), 파일·식별자 네이밍, 상태 책임(TanStack Query·Redux·URL), 네이티브(Kotlin) 모듈 규칙, 작업 완료 체크리스트를 정의한다.
---

# MOBI.AI 아키텍처 규칙

Pleos Connect(현대자동차 차량 OS, Android Automotive 기반) 위에서 도는 Expo(React Native) 앱이다.
팀원 모두와 모든 AI 세션이 같은 규칙으로 코드를 쓰기 위한 기준이다. **규칙과 다른 구조가 필요하면 임의로 바꾸지 말고 사용자에게 먼저 확인한다.**
참고 구현은 `src/features/bodyfit` 이다. 새 서비스는 이 폴더의 모양을 그대로 따른다 (`add-service` 스킬).

## 1. 계층과 의존 방향 (ESLint `boundaries/dependencies`로 강제)

```
app → core → features → shared → native(modules/*)
```

| 계층 | 위치 | 책임 | import 가능 대상 |
| --- | --- | --- | --- |
| app | `src/app/` | Expo Router 라우트. feature 화면 조립만. 비즈니스 로직 금지 | core, features, shared |
| core | `src/core/` | 앱 전역 인프라 (Providers, QueryClient, Redux store) | features, shared |
| features | `src/features/<서비스>/` | 서비스(도메인) 로직 전부 | 같은 서비스 내부, shared, `@/core/store/hooks` 만 |
| shared | `src/shared/` | 도메인과 무관한 공용 코드 (ui, pleos) | shared, native |
| native | `modules/<모듈>/` | Expo 로컬 네이티브 모듈 (Kotlin + JS 계약) | — |

- **서비스끼리 import 금지** (`features/a` → `features/b`). 공유할 코드는 도메인을 걷어내고 `shared`로 올리거나, `app`에서 두 서비스를 조립한다.
- **차량 SDK(Pleos)는 `src/shared/pleos/*` 를 통해서만 쓴다.** `@modules/*` 직접 import 는 `shared/pleos` 밖에서 ESLint 에러다.
  - `pleos.ts`: `pleos()`(차량이 아니면 `PleosUnavailableError`), `isPleosAvailable()`, `pleosErrorCode()`
  - `pleos.types.ts`: 타입·`SEAT_AXES`. 네이티브 모듈을 불러오지 않으므로 `model` 과 테스트는 이 파일만 import 한다.
  - `use-gear.ts`, `use-pleos-event.ts`: 기어·차량 이벤트 구독 훅
- `src/` 바로 아래에 새 최상위 폴더를 만들지 않는다 (`boundaries/no-unknown-files` 에러).
- 배럴 파일(`index.ts`)을 만들지 않는다. 항상 실제 파일 경로로 import 한다.
- 다른 계층은 `@/` 별칭(`src/`), 네이티브 모듈은 `@modules/` 별칭, 같은 서비스 내부는 상대 경로(`../model/...`)로 import 한다.
- 루트 폴더: `modules/`(네이티브 모듈), `assets/`, `scripts/`(개발 도구), `supabase/migrations/`(DB 변경 이력). 그 외 새 루트 폴더는 사용자와 먼저 상의한다.
- `android/` 는 `npx expo prebuild` 가 만드는 생성물이다(gitignore). **직접 고치지 않는다.** 네이티브 설정은 `app.config.ts` 와 config plugin(`modules/*/app.plugin.js`)으로만 바꾼다.

## 2. 서비스 내부 구조

```
features/<서비스>/
├── model/    순수 타입·zod 스키마·Redux 슬라이스·순수 함수(+ *.test.ts). React·저장소·차량 SDK 호출 금지
├── api/      데이터 계층. 기기 저장소(*.storage.ts), queryOptions(*.queries.ts), useMutation 훅(*.mutations.ts), 차량 호출 묶음
└── ui/       화면·컴포넌트 (React Native)
```

서비스 내부 import 방향: `ui → api → model`, `ui → model`.

- `model` 은 테스트하기 쉬워야 한다. 차량 값은 인자로 받는다 (`toSeatRatios(state)` 처럼).
- 화면 하나는 `ui/<서비스>-<이름>-screen.tsx` 컴포넌트 하나다. 라우트 파일은 그 컴포넌트를 렌더하고 URL 파라미터만 넘긴다.

## 3. 파일·식별자 네이밍

| 대상 | 규칙 | 예 (`bodyfit`) |
| --- | --- | --- |
| 서비스 폴더 | 소문자 kebab-case 단수 | `features/bodyfit` |
| 타입 | `model/<서비스>.types.ts` | `BodyProfile`, `SeatRatios` |
| zod 스키마 | `model/<서비스>.schema.ts` → `<대상>Schema` | `bodyProfileInputSchema` |
| 순수 로직 | `model/<서비스>-<주제>.ts` (+ 같은 이름 `.test.ts`) | `bodyfit-recommend.ts` |
| Redux 슬라이스 | `model/<서비스>-<주제>.slice.ts`, `name`은 camelCase | `bodyfitSessionSlice` (`name: "bodyfitSession"`) |
| 슬라이스 액션 | 과거형 이벤트 이름 | `driverSelected`, `feedbackProposed` |
| 셀렉터 | `select<대상>` (슬라이스 `selectors` 로 정의) | `selectActiveDriverId` |
| 기기 저장소 | `api/<서비스>.storage.ts` → `find*`, `create*`, `delete*` | `findBodyProfiles` |
| 캐시 계약 | `api/<서비스>.queries.ts` → `<서비스>Keys`, `<서비스>Queries` | `bodyfitKeys.seat()`, `bodyfitQueries.profile(id)` |
| 뮤테이션 훅 | `api/<서비스>.mutations.ts` → `use<동사><대상>` | `useMoveSeat` |
| 컴포넌트 파일 | `ui/<서비스>-<이름>.tsx` (kebab-case), named export PascalCase | `bodyfit-seat-screen.tsx` → `BodyfitSeatScreen` |
| 라우트 | `src/app/(<서비스>)/<서비스>/...` | `app/(bodyfit)/bodyfit/[profileId].tsx` |

- `export default` 는 Expo Router 라우트·레이아웃 파일에만 쓴다. 나머지는 named export.
- query key는 `["<서비스>", ...]` 로 시작해 서비스 간 캐시 충돌을 막는다.

## 4. 상태 책임

세부 규칙은 `redux-toolkit`(Redux 아키텍처)·`react-query` 스킬에 있다.

| 상태 | 담당 | 금지 |
| --- | --- | --- |
| 비동기로 읽는 데이터 (기기 저장소, 차량 값) | TanStack Query (`api/*.queries.ts`) | 읽은 값을 Redux·useState 에 복사 |
| 데이터 변경·차량 제어 | `useMutation` (`api/*.mutations.ts`) → `onSettled` 에서 `invalidateQueries` | 컴포넌트에서 SDK 직접 호출 |
| 앱 전역 UI·세션 상태 (현재 운전자, 확인 대기 중인 조절안) | Redux Toolkit 슬라이스 | 저장된 데이터를 슬라이스에 저장 |
| 화면 식별 상태 (어떤 운전자 화면인지) | 라우트 파라미터 (`[profileId]`) | 같은 값을 Redux 에 중복 저장 |
| 한 컴포넌트 안의 상태 | `useState` | 불필요한 전역화 |
| 차량 이벤트 (기어, 착석, 도착) | `usePleosEvent` / `useGear` | 폴링 |

## 5. 네이티브 모듈 (`modules/pleos-connect`)

- Pleos Connect SDK(Vehicle·NaviHelper·SpeechToText·TextToSpeech)를 Kotlin 으로 감싸 JS 로 노출한다. 버전은 `android/build.gradle`, 권한은 `android/src/main/AndroidManifest.xml` 에 있다.
- JS 계약은 `src/PleosConnect.types.ts` + `src/PleosConnectModule.ts` 이고 Kotlin `PleosConnectModule.kt` 와 1:1 로 맞춘다. 한쪽을 바꾸면 다른 쪽도 함께 바꾼다.
- 에러는 `CodedException` 의 코드(`ERR_NOT_PARKED` 등)로 JS 에 넘기고, JS 는 `pleosErrorCode()` 로 분기한다. 사용자 문구는 `ui/*-error-copy.ts` 에서 만든다.
- Pleos 콜백 API 는 `suspendPleos` 로 감싸 `AsyncFunction(...) Coroutine` 으로 노출한다. SDK 콜백의 Kotlin 널 허용 여부는 문서에 없으므로 콜백 람다는 넓은 타입(널 허용)으로 선언한다.
- SDK 시그니처가 궁금하면 문서보다 AAR 을 믿는다: `https://nexus-playground.pleos.ai/repository/maven-releases/ai/pleos/playground/<모듈>/<버전>/` 에서 받아 `javap` 로 확인한다 (권한은 메서드의 `@RequiresPermission`).
- deprecated·제공 종료된 SDK 는 쓰지 않는다 (예: Pleos Gear → Android Car API `GEAR_SELECTION`, LLM SDK 는 2026-10-19 제공 종료).
- 네이티브 코드를 바꾸면 Fast Refresh 로 반영되지 않는다. `npm run android:emulator`(또는 `android:device`)로 다시 빌드한다. Android 스크립트는 `scripts/android/` 에 종류별로 하나씩 둔다.

## 6. 코드 스타일

- Prettier 기본값: 큰따옴표, 세미콜론, trailing comma.
- 주석은 **왜** 그렇게 했는지만 짧은 한국어로 쓴다. 코드가 말하는 내용을 반복하지 않는다.
- 의존성은 `npx expo install <패키지>` 로 추가한다 (SDK 와 맞는 버전). 꼭 필요할 때만 추가하고, 추가 이유를 사용자에게 알린다.
- Expo·React Native API 는 SDK 마다 바뀐다. 처음 쓰는 API 는 `package.json` 의 `expo` 메이저 버전에 맞는 문서(`https://docs.expo.dev/versions/v<메이저>.0.0/`)에서 확인한다.

## 7. 작업 완료 체크리스트

작업을 끝냈다고 보고하기 전에 모두 확인한다. 하나라도 실패하면 고치고 다시 실행한다.

1. `npm run lint` — 아키텍처 위반(`boundaries/*`), 차량 SDK 창구 규칙, 디자인 토큰, 마이그레이션 검사 포함 에러 0
2. `npm run typecheck`
3. `npm test` — `model` 의 순수 로직을 바꿨다면 테스트도 함께 고친다
4. 네이티브 모듈·`app.config.ts`·의존성을 바꿨다면 `npm run android:build:debug`
5. 폴더 구조나 규칙이 바뀌었다면 `README.md` 를 함께 갱신
6. 보안·차량 제어 관련 코드를 건드렸다면 `secure-coding` 스킬의 체크리스트 확인
7. 화면(UI)을 만들거나 바꿨다면 `ui-design` 스킬의 완료 체크리스트 확인
8. push 전에 `npm run verify` 통과 (`testing` 스킬)

> 파일을 수정할 때마다 PostToolUse 훅이 ESLint를 돌려 위반을 바로 알려준다. 훅이 위반을 보고하면 다음 작업으로 넘어가기 전에 고친다.

## 8. 자주 하는 실수

- `features/a/ui` 에서 `@/features/b/...` import → 공용 부분을 `shared`로 추출하거나 `app` 에서 조립
- feature 에서 `@modules/pleos-connect/...` import → `@/shared/pleos/pleos` 의 `pleos()` 사용
- `model` 에서 `@/shared/pleos/pleos` import (네이티브 모듈이 딸려 옴) → `@/shared/pleos/pleos.types`
- `android/` 를 직접 수정 → 다음 prebuild 에서 사라진다. `app.config.ts`·config plugin 으로 옮긴다
- query key를 문자열 배열로 하드코딩 → 반드시 `<서비스>Keys` / `<서비스>Queries` 사용
- 차량에서 읽은 값을 Redux에 저장 → TanStack Query 캐시를 그대로 사용
