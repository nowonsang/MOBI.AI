---
name: testing
description: MOBI.AI 자동화 테스트(Jest 단위 테스트 + Android 빌드 검증) 규칙과 push 전 검증 절차. git push, 커밋 후 원격 반영, 테스트 작성·수정, model 순수 로직·네이티브 모듈·app.config.ts 를 바꿀 때 반드시 로드한다. npm run verify 로 린트·타입·단위 테스트·Android 빌드를 통과한 뒤에만 push 한다.
---

# 테스트와 push 전 검증

## 1. push 규칙 (AI 필수)

1. **push 하기 전에 반드시 `npm run verify` 를 실행하고, 전부 통과했을 때만 push 한다.**
   - `verify` = `lint` → `typecheck` → `test`(Jest) → `scripts/android/build.mjs debug --arch arm64-v8a`(prebuild + Gradle `assembleDebug`, Kotlin 컴파일·Pleos SDK 의존성 확인)
2. 실패하면 push 하지 않고, 원인을 고친 뒤 다시 `verify` 를 돌린다. 테스트를 지우거나 `skip` 해서 통과시키지 않는다.
3. `git push --no-verify` 로 pre-push 훅을 건너뛰지 않는다.
4. 사용자에게 보고할 때 통과한 테스트 수를 함께 알린다.

`.githooks/pre-push` 가 같은 검사를 자동으로 돌린다 (활성화는 `project-setup` 스킬 5단계).

## 2. 실행 방법

| 명령 | 대상 | 용도 |
| --- | --- | --- |
| `npm test` | `src/**/*.test.ts` (jest-expo) | 순수 로직 단위 테스트 |
| `npx jest src/features/bodyfit/model/bodyfit-feedback.test.ts` | 특정 파일만 | 디버깅 |
| `npm run android:build:debug` | prebuild + `./gradlew assembleDebug` | 네이티브 모듈·설정·SDK 의존성 확인 (처음은 수 분) |
| `npm run android:emulator` | 에뮬레이터를 켜고 빌드·설치·실행 (`-- --avd <이름>`) | 직접 확인 |
| `npm run android:device` | 내 기기에 빌드·설치·실행 (`-- --device <시리얼>`) | 직접 확인 |
| `npm run verify` | 위 전부 | push 전 필수 |

- 빌드 스크립트는 기존 `android/` 를 유지한 채 prebuild 한다. 설정이 꼬였으면 `npm run android:prebuild:clean` 으로 다시 만든다.
- `verify` 의 빌드는 컴파일 확인용이라 C++ 를 arm64-v8a 하나만 빌드한다 (네 가지 CPU 구조를 모두 빌드하면 몇 배 느리다). `android:emulator`·`android:device` 는 연결된 기기에 맞는 구조로 빌드한다.
- Android 빌드에는 JDK 17 과 Android SDK(`ANDROID_HOME`)가 필요하다 (`project-setup` 스킬).

## 3. 테스트 작성 규칙

- 위치: 대상 파일 옆 `<같은 이름>.test.ts` (예: `model/bodyfit-recommend.test.ts`).
- **`model` 의 순수 로직을 추가·변경하면 같은 작업에서 테스트도 추가·수정한다.** 특히:
  - 차량에 보낼 값을 만드는 계산 (비율 ↔ 원시 값, 범위 자르기)
  - 신뢰하지 않는 입력의 검증 (음성 인식 결과 해석, 저장된 값, 사용자 입력 파싱)
  - 학습·추천 계수 (방향성과 0~1 범위 유지)
- 테스트 이름은 동작을 한국어 문장으로 쓴다 ("키가 클수록 시트를 뒤로 보낸다").
- 테스트는 `@/shared/pleos/pleos.types` 만 쓰고 네이티브 모듈을 부르지 않는다. 차량 호출이 필요한 로직은 값을 인자로 받도록 `model` 로 분리해서 테스트한다.
- 테스트에 실제 비밀 값·개인정보를 쓰지 않는다. 외부 서비스(공유 Supabase 포함)에 쓰기를 하는 테스트를 만들지 않는다.

## 4. 차량 동작 확인 (수동)

자동 테스트로 확인할 수 없는 차량 동작은 Pleos Connect 에뮬레이터에서 직접 확인하고 결과를 PR 에 적는다.

1. 에뮬레이터는 **콜드 부트**로 켠다 (퀵 부트면 VHAL 이 동작하지 않는다).
2. 기어 P 에서 "추천 자세로 맞추기" → 시트가 움직이고 멈추는지, 움직이는 중 "멈추기"가 동작하는지
3. 기어를 D 로 바꾸면 버튼이 비활성화되고, 움직이는 중이었다면 즉시 멈추는지
4. "말로 알려 주기" → 음성 인식 → 조절안 확인 → 조절
5. 주행 규제 켜기·끄기: `adb shell cmd hmg_car_service --service drivingstate driving_regulation on` (끄기는 `off`). 기어·착석 등은 Virtual Console(`adb forward tcp:8088 tcp:8088` → http://127.0.0.1:8088/)에서 바꾼다.
6. **폼 팩터 테스트**: 에뮬레이터를 별도 창으로 실행(Running Devices 창·Headless 금지) → Host Display Bridge(`https://nexus-playground.pleos.ai/repository/raw-releases/host-display-bridge/1.0.0/host-display-bridge.zip`, Go 1.22+, `go run . --avd "<AVD 이름>"`) → 에뮬레이터의 FormFactorConsole 에서 Display preset·Orientation(Portrait/Landscape) 선택 → 가상 디스플레이 생성 → 잘림·겹침, 글자·아이콘 크기, 가로·세로 배치, 터치·화면 전환 확인. 12.9인치 Portrait, 14.6인치 Landscape 는 반드시 본다.
7. 차량이 아닌 기기(일반 Android 에뮬레이터)에서는 "차량에 연결되어 있지 않아요" 안내가 나오고 앱이 죽지 않는지

## 5. 실패했을 때

1. Android 빌드 실패: Gradle 로그의 첫 `e:`(Kotlin 컴파일 오류) 또는 `Could not resolve`(의존성) 줄을 찾는다.
   - `Could not resolve ai.pleos.playground:...` → `app.config.ts` 의 `extraMavenRepos` 와 SDK 버전(`modules/pleos-connect/android/build.gradle`)을 확인한다.
   - Kotlin 타입 오류 → SDK 시그니처를 AAR 에서 확인한다 (`project-architecture` 스킬 5장).
2. Jest 실패: `@/` 경로를 못 찾으면 `package.json` 의 `jest.moduleNameMapper` 를 확인한다.
