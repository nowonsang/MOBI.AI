---
name: add-service
description: MOBI.AI에 새 서비스(도메인 모듈)를 추가하는 절차. "새 서비스/도메인/기능 영역 추가", "새 기능 화면 만들기", "features 폴더에 새 모듈" 같은 요청에 사용한다. features/<서비스> + app/(<서비스>)/<서비스> 를 참고 구현인 bodyfit 서비스와 같은 모양으로 만든다.
argument-hint: <서비스 이름 (kebab-case, 예: climate, trip-log)>
---

# 새 서비스 추가

먼저 `project-architecture` 스킬의 규칙을 따른다. **참고 구현은 `src/features/bodyfit` 이다.** 새 파일은 bodyfit 의 같은 역할 파일을 열어 모양(이름·export·주석 밀도)을 그대로 따른다.

## 0. 확인할 것

- 서비스 이름: 소문자 kebab-case 단수 (`climate`, `trip-log`). 식별자에는 camelCase(`tripLog`)·PascalCase(`TripLog`)로 쓴다.
- 경로: 라우트 그룹 `(서비스)`는 URL에 나타나지 않는다. 화면 경로를 사용자에게 확인한다 (예: `/climate`). `/` 는 첫 화면으로 보내는 `src/app/index.tsx` 전용이다.
- 다른 서비스의 데이터가 필요하면 서비스끼리 import 하지 말고 `app` 에서 조립하거나 `shared` 로 추출한다.
- 새 차량 기능(Pleos SDK 의 다른 도메인·권한)이 필요하면 **먼저 사용자와 상의한다.** Pleos 권한은 Pleos App Market 과 사전 협의된 범위만 쓸 수 있다 (`secure-coding` 스킬 5장).

## 1. 만들 파일 (`climate` 예시, 괄호는 bodyfit 의 대응 파일)

```
src/features/climate/
├── model/climate.types.ts             (bodyfit.types.ts)
├── model/climate.schema.ts            (bodyfit.schema.ts)     입력·저장값을 검증할 때
├── model/climate-<주제>.ts + .test.ts (bodyfit-recommend.ts)  순수 로직
├── model/climate-<주제>.slice.ts      (bodyfit-session.slice.ts) 앱 전역 UI 상태가 있을 때만
├── api/climate.storage.ts             (bodyfit.storage.ts)    기기 안 저장이 필요할 때
├── api/climate.queries.ts             (bodyfit.queries.ts)    캐시 계약
├── api/climate.mutations.ts           (bodyfit.mutations.ts)
└── ui/climate-<이름>-screen.tsx        (bodyfit-seat-screen.tsx)
src/app/(climate)/_layout.tsx          ((bodyfit)/_layout.tsx)
src/app/(climate)/climate/index.tsx    ((bodyfit)/bodyfit/index.tsx)
```

## 2. 규칙 요약

- **캐시 계약**: `<서비스>Keys`(`["<서비스>", ...]`)와 `<서비스>Queries`(`queryOptions`)를 한 파일에. 차량 값처럼 밖에서 바뀌는 데이터는 `staleTime: 0`.
- **차량 호출**: `api/` 에서 `pleos()` (`@/shared/pleos/pleos`) 로만. 차량이 아니면 `PleosUnavailableError` 가 던져지므로 화면은 `isPleosAvailable()` 로 미리 분기하고, 에러는 `pleosErrorCode()` 로 문구를 고른다.
- **뮤테이션**: `onSettled` 에서 관련 query key 를 `invalidateQueries` 한다. 차량을 움직이는 뮤테이션은 화면에서 확인 대화상자를 거친 뒤에만 호출한다.
- **화면**: 라우트 파일은 `ui/*-screen.tsx` 를 렌더하고 URL 파라미터만 넘긴다. 레이아웃은 `@/shared/ui/screen` 의 `Screen` 을 쓴다.
- **저장**: 개인정보는 기기 안(`expo-sqlite/kv-store`)에만 저장하고, 읽을 때 zod 로 검증한다 (형식이 다르면 빈 값으로).

## 3. 연결

1. Redux 슬라이스를 만들었다면 `src/core/store/store.ts` 의 `reducer` 에 `[slice.name]: slice.reducer` 로 추가한다.
2. 새 네이티브 기능이 필요하면 `modules/pleos-connect` 의 Kotlin(`PleosConnectModule.kt`)과 JS 계약(`src/PleosConnect.types.ts`, `src/PleosConnectModule.ts`)을 함께 고치고, 권한은 모듈 `AndroidManifest.xml` 에 이유 주석과 함께 추가한다.
3. 새 환경 변수가 필요하면 사용자와 상의한다. `EXPO_PUBLIC_` 변수는 앱 번들에 그대로 들어가므로 비밀 값에 쓰지 않는다.
4. `README.md` 폴더 구조에 서비스를 추가한다.

## 4. 검증

`npm run lint && npm run typecheck && npm test` 가 모두 통과해야 완료다. 네이티브 모듈이나 `app.config.ts` 를 바꿨다면 `npm run android:build:debug` 도 통과해야 한다.
