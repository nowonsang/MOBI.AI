---
name: project-setup
description: MOBI.AI 저장소를 처음 받은 팀원의 개발 환경 설정 절차 (Expo/React Native + Pleos Connect 에뮬레이터). "처음 clone 했어", "세팅해줘", "환경 설정", "에뮬레이터 설정", ".env.local 만들었어", "Pleos 키 받았어", "빌드가 안 돼" 같은 요청이나, 새 팀원 온보딩·로컬 실행 준비를 도울 때 사용한다. Node·JDK·Android SDK, Pleos Connect 에뮬레이터, .env.local 작성(사람이 직접), 키 파일 권한 600, 커밋 전 비밀 검사 활성화, 첫 빌드·실행 순서를 안내한다.
---

# 처음 받은 팀원 환경 설정

순서대로 진행하고, 각 단계가 끝났는지 확인한 뒤 다음으로 넘어간다.

## 0. 준비물

| 항목 | 버전 | 확인 |
| --- | --- | --- |
| Android Studio·JDK 가 없을 때 | 저장소 루트 `ANDROID_SETUP.md` 의 1~6장부터 | `npm run android:doctor` |
| Node.js | 22.13+ 또는 24.3+ (Expo SDK 58 요구) | `node -v` |
| JDK | 17 | `java -version` |
| Android Studio + Android SDK | `ANDROID_HOME` 설정 | `echo $ANDROID_HOME` |
| Pleos Playground 계정 | [developers.pleos.ai](https://developers.pleos.ai) 가입 → My Project 생성 | — |
| GPU (에뮬레이터) | 최소 RTX 3060 Laptop 6GB / RX 6600M 8GB 급, 권장 RTX 4060 Laptop 8GB 급 | — |

- Pleos Playground: Workspace → My Project → **프로젝트 생성**(프로젝트 이름, 개발사명, 카테고리, 설명) → 왼쪽 **SDK** 메뉴에서 SDK 별 사용 신청.
  - Vehicle State·NaviHelper: 신청 없이 사용 가능. Vehicle Control(시트 이동)·SpeechToText·TextToSpeech: "준비 중"(아직 신청 불가). "제휴 계약 필요" 항목은 partnership@pleos.ai.
  - 프로젝트 정보의 **프로젝트 ID(Key)** 는 앱 심사 제출 때, **클라이언트 ID·시크릿** 은 STT·TTS 서버 연결에 쓴다.
- SDK 클라이언트 ID·시크릿은 Pleos Playground → My Project 에서 직접 받거나, 프로젝트 소유자에게 **안전한 경로로만** 받는다. 메신저·메일·이슈·채팅(AI 포함)에 붙여 넣지 않는다.

## 1. 의존성 설치

```bash
npm install
```

## 2. Pleos Connect 에뮬레이터 (Android Studio, 사람이 직접)

1. Android Studio → Settings → Languages & Frameworks → Android SDK → **SDK Update Sites** 에 Pleos 시스템 이미지 사이트를 추가한다.
   - macOS(Apple Silicon): `https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-arm64-sys-img.xml`
   - Windows/Linux: `https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-sys-img.xml`
2. SDK Platforms 에서 **Pleos Connect 시스템 이미지(API 34)** 를 설치한다.
3. Device Manager → 새 기기: Form Factor **Automotive**, 기기 **Pleos Connect v2.1.0**, 이미지 API 34(Pleos Connect v2.1.0 APIs), RAM 4GB.
4. Advanced Settings → Startup → Default boot: **Cold**. (퀵 부트면 VHAL 이 동작하지 않아 시트·기어 값을 읽지 못한다)
5. CRN 주입은 필요 없다 (Emulator 2.1.0 부터 제공 종료). 기본 언어는 한국어이며 차량 설정 → 일반 설정 → 언어/Language 에서 바꾼다. 마이크는 Extended Controls → Microphone.
6. 차량 상태(기어·착석·도어 등)는 **Virtual Console** 로 바꾼다: `adb forward tcp:8088 tcp:8088` 후 http://127.0.0.1:8088/ → Emulation Controls.

> 주소·버전은 Pleos 문서(document.pleos.ai)가 바뀌면 그쪽을 따른다. 소프트웨어 개발 환경 요구 사항: Android API 28 이상, Gradle 8.0 이상, Java/Kotlin, Pleos Connect Emulator 2.1.0.

## 3. `.env.local` 작성 (사람이 직접)

프로젝트 루트에 `.env.local` 을 만들고 아래 **이름**으로 값을 넣는다. gitignore 대상이라 커밋되지 않는다.

| 이름 | 값 | 없으면 |
| --- | --- | --- |
| `PLEOS_CLIENT_ID` | My Project → SDK 클라이언트 ID | 음성 인식·음성 안내를 온디바이스 모드로만 쓴다 |
| `PLEOS_CLIENT_SECRET` | My Project → SDK 클라이언트 시크릿 | 위와 같음 |

- **AI는 이 파일을 만들거나 읽거나 고치지 않는다.** 보호 훅과 deny 규칙이 막고 있으며, 우회하지 않는다. 사용자가 직접 편집기로 작성한다.
- 값은 어떤 경우에도 대화창에 쓰지 않는다. AI는 변수 **이름**만 안내한다.
- `EXPO_PUBLIC_` 접두어를 붙이지 않는다 (JS 번들에 그대로 들어간다).
- 값을 바꾼 뒤에는 `npm run android:prebuild:clean` 으로 네이티브 폴더를 다시 만들어야 반영된다.
- 기존 Supabase 변수(`SUPABASE_*`)는 앱에서 쓰지 않는다. DB 작업 때 `npm run check:supabase` 에만 쓰인다.

## 4. 키 파일 권한을 본인 전용(600)으로

```bash
npm run secure:env
```

- 프로젝트 루트의 `.env*` 파일 권한을 600(본인만 읽기·쓰기)으로 바꾼다. 파일 **내용은 읽지 않으므로 AI가 실행해도 된다.**
- env 파일을 새로 만들 때마다 다시 실행한다. Windows는 이 권한 체계가 없어 건너뛴다.

## 5. 커밋·push 전 자동 검사 켜기 (사용자가 직접)

git 설정을 바꾸는 단계라 AI가 실행하지 않는다. 사용자에게 Claude Code 입력창에 아래를 그대로 입력하도록 안내한다.

```
! chmod +x .githooks/pre-commit .githooks/pre-push && git config core.hooksPath .githooks
```

- **커밋 전**: `.env*`·키 파일·서명 키, 비밀 값 패턴이 섞인 커밋을 막는다. 이 저장소는 GitHub에 공개되어 있으므로 반드시 켠다.
- **push 전**: `npm run verify`(린트·타입·단위 테스트·Android 빌드)가 통과해야 push 된다 (`testing` 스킬).

## 6. 첫 빌드와 실행

```bash
npm run android:doctor    # 환경 점검 ("결과: 통과" 확인)
npm run android:emulator  # 에뮬레이터를 (꺼져 있으면 콜드 부트로) 켜고 빌드·설치·실행. 처음은 수 분
npm run android:device    # 또는 USB 로 연결한 내 기기에서 실행
```

- 이후 JS 만 바꿨다면 `npm start` 로 개발 서버만 띄워도 된다 (Fast Refresh). 네이티브 모듈·`app.config.ts`·의존성을 바꾸면 `npm run android:emulator`(또는 `android:device`)로 다시 빌드한다.
- Expo Go 는 쓸 수 없다 (Pleos 네이티브 모듈이 없다). 항상 개발 빌드를 쓴다.

## 실패 시 조치

| 증상 | 조치 |
| --- | --- |
| `Could not resolve ai.pleos.playground:...` | 네트워크에서 `nexus-playground.pleos.ai` 접근 확인, `npm run android:prebuild:clean` 으로 다시 생성 |
| `SDK location not found` | `ANDROID_HOME` 설정 확인 (Android Studio → SDK 경로) |
| 앱에 "차량에 연결되어 있지 않아요" | 일반 에뮬레이터가 아니라 **Automotive(Pleos Connect)** 에뮬레이터인지 확인 |
| 시트·기어 값을 못 읽음 | 에뮬레이터를 콜드 부트로 다시 켜고, Virtual Console 에서 값을 바꿔 본다 |
| 음성 인식 `UNAUTHENTICATED` | `.env.local` 의 Pleos 앱 등록 정보 확인 → `npm run android:prebuild:clean` → `npm run android:emulator` |
| `EBADENGINE` 경고 | Node 를 22.13+ 또는 24.3+ 로 올린다 |

## AI 작업 규칙

- 사용자가 "세팅해줘"라고 하면 1 → 4 → 6 단계는 AI가 실행하고, 2·3·5 단계는 사용자가 직접 하도록 안내한다.
- `.env.local` 내용을 보여 달라거나 확인해 달라는 요청에는 응하지 않는다.
- 이후 작업은 `project-architecture`, `secure-coding`, `ui-design` 스킬을 따른다.
