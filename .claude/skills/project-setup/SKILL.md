---
name: project-setup
description: MOBI.AI 개발 환경 설정과 Pleos Connect 에뮬레이터 실행 절차 (Expo/React Native). "처음 clone 했어", "세팅해줘", "환경 설정", "에뮬레이터 설정", "에뮬레이터 켜줘", "앱 실행해줘", "빌드해서 띄워줘", ".env.local 만들었어", "Pleos 키 받았어", "빌드가 안 돼" 같은 요청이나, 새 팀원 온보딩·로컬 실행 준비를 도울 때 사용한다. 앱은 일반 Android 에뮬레이터가 아니라 Pleos Connect 에뮬레이터에서 실행한다 — 설치 여부 확인 → 없으면 설치 안내 → 켜고 빌드. Node·JDK·Android SDK, .env.local 작성(사람이 직접), 키 파일 권한 600, 커밋 전 비밀 검사 활성화도 안내한다.
---

# 환경 설정과 Pleos Connect 에뮬레이터 실행

순서대로 진행하고, 각 단계가 끝났는지 확인한 뒤 다음으로 넘어간다.

**실행 대상은 Pleos Connect 에뮬레이터 하나다.** 일반 Android 에뮬레이터(폰·태블릿·일반 Automotive)에는 Pleos SDK 서비스가 없어 차량 기능이 동작하지 않는다. Pleos Connect 에뮬레이터가 없으면 다른 에뮬레이터로 대신하지 않고 **설치부터** 안내한다.

```
앱 실행 요청 → 2-1 설치 확인 ─ 있음 → 6 켜고 빌드·실행
                      └ 없음 → 2-2 설치 안내(사람이 직접) → 2-1 다시 확인 → 6
```

## 0. 준비물

| 항목 | 버전 | 확인 |
| --- | --- | --- |
| Android Studio·JDK 가 없을 때 | 저장소 루트 `ANDROID_SETUP.md` 의 1~4장부터 | `npm run android:doctor` |
| Node.js | 22.13+ 또는 24.3+ (Expo SDK 58 요구) | `node -v` |
| JDK | 17 | `java -version` |
| Android Studio + Android SDK | `ANDROID_HOME` 설정 | `echo $ANDROID_HOME` |
| Pleos Connect 에뮬레이터 | Emulator 2.1.0 (API 34, Automotive) | `npm run android:doctor` (2장) |
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

## 2. Pleos Connect 에뮬레이터 준비 (확인 → 없으면 설치)

### 2-1. 설치돼 있는지 확인 (AI가 실행)

```bash
npm run android:doctor
```

아무것도 설치·변경하지 않는 점검이다. Pleos Connect 시스템 이미지로 만든 AVD 가 있는지를 AVD 이름이 아니라 AVD 가 쓰는 시스템 이미지로 판단한다.

| 출력 | 뜻 | 다음 |
| --- | --- | --- |
| `PASS Pleos Connect 에뮬레이터: <AVD 이름>` | 준비됨 | 6장 |
| `FAIL Pleos Connect 시스템 이미지는 설치돼 있는데, 에뮬레이터(AVD)를 아직 만들지 않았어요` | 시스템 이미지만 있음 | 2-2 의 3번부터 |
| `FAIL Pleos Connect 에뮬레이터가 설치돼 있지 않아요` | 시스템 이미지부터 없음 | 2-2 의 1번부터 |
| `FAIL Android SDK 가 없어요` / `FAIL Android Emulator 가 없어요` | Android Studio 부터 없음 | `ANDROID_SETUP.md` 1~4장 → 2-2 |

`npm run android:devices` 는 AVD 목록에서 Pleos Connect AVD 에 `← Pleos Connect` 표시를 붙여 보여 준다.

### 2-2. 없으면 설치 (Android Studio, 사람이 직접)

Android Studio 화면에서 하는 작업이라 AI 가 대신하지 않는다. AI 는 2-1 결과에 맞는 번호부터 **한 번에 한 단계씩** 안내하고, 사용자가 끝냈다고 하면 2-1 을 다시 실행해 `PASS` 를 확인한다. 일반 Android AVD 가 이미 있어도 그것으로 넘어가지 않는다.

1. **시스템 이미지 사이트 추가**: Android Studio → Settings → Languages & Frameworks → Android SDK → **SDK Update Sites** → **+**
   - macOS(Apple Silicon): `https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-arm64-sys-img.xml`
   - Windows/Linux: `https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-sys-img.xml`
2. **시스템 이미지 설치**: **SDK Platforms** 탭 → Show Package Details → API 34 아래 **Pleos Connect 시스템 이미지** 체크 → Apply.
3. **에뮬레이터 만들기**: Device Manager → **+** → Form Factor **Automotive** → 기기 **Pleos Connect v2.1.0** → 이미지 API 34(Pleos Connect v2.1.0 APIs).
4. **부팅 설정**: Advanced Settings → RAM **4GB**, Startup → Default boot **Cold**. (퀵 부트면 VHAL 이 동작하지 않아 시트·기어 값을 읽지 못한다)

> 주소·버전은 Pleos 문서(document.pleos.ai)가 바뀌면 그쪽을 따른다. 소프트웨어 개발 환경 요구 사항: Android API 28 이상, Gradle 8.0 이상, Java/Kotlin, Pleos Connect Emulator 2.1.0.

### 2-3. 켠 뒤에 쓰는 것

- CRN 주입은 필요 없다 (Emulator 2.1.0 부터 제공 종료). 기본 언어는 한국어이며 차량 설정 → 일반 설정 → 언어/Language 에서 바꾼다.
- 마이크(음성 인식 시험): Extended Controls → Microphone → 호스트 오디오 입력 허용.
- 차량 상태(기어·착석·도어 등)는 **Virtual Console** 로 바꾼다: `adb forward tcp:8088 tcp:8088` 후 http://127.0.0.1:8088/ → Emulation Controls.

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

## 6. Pleos Connect 에뮬레이터를 켜고 빌드·실행

2-1 이 `PASS` 인 것을 확인한 뒤 실행한다.

```bash
npm run android:emulator
```

이 명령 하나가 아래를 순서대로 한다.

1. **Pleos Connect 에뮬레이터를 찾는다.** 없으면 설치 안내를 출력하고 끝난다 (다른 AVD 로 대신 실행하지 않는다) → 2-2 로 돌아간다.
2. **켠다.** 꺼져 있으면 콜드 부트로 켜고 부팅이 끝날 때까지 기다린다 (1~3분). 이미 켜져 있으면 그대로 쓴다. 일반 Android 에뮬레이터가 켜져 있어도 거기에는 설치하지 않는다.
3. **빌드·설치·실행한다.** 개발 빌드를 만들어 설치하고 개발 서버(Metro)를 켜 둔다. 처음은 수 분.

출력의 `대상 에뮬레이터: emulator-XXXX (<Pleos AVD 이름>)` 줄로 Pleos Connect 에뮬레이터에 올라갔는지 확인한다.

- 에뮬레이터를 켜는 것과 빌드를 따로 하지 않는다. `emulator -avd …`, `npx expo run:android`, `adb install` 을 직접 쓰지 않는다 (`expo run:android` 는 연결된 아무 기기나 고른다).
- 빌드가 끝나도 개발 서버가 남아 명령이 끝나지 않는다. AI 가 실행할 때는 백그라운드로 실행하고, 끝낼 때는 Ctrl+C.
- 이후 JS 만 바꿨다면 `npm start` 로 개발 서버만 띄워도 된다 (Fast Refresh). 네이티브 모듈·`app.config.ts`·의존성을 바꾸면 `npm run android:emulator` 로 다시 빌드한다.
- Expo Go 는 쓸 수 없다 (Pleos 네이티브 모듈이 없다). 항상 개발 빌드를 쓴다.
- `-- --avd <이름>`: Pleos Connect AVD 가 여러 개일 때 고른다. 일반 Android AVD 이름은 사용자가 "차량이 아닌 기기 안내 화면"(`testing` 스킬 4장 7번) 확인을 요청했을 때만 넘긴다.
- `npm run android:device` (USB 실기기): 일반 휴대폰에서는 차량 기능이 동작하지 않는다. 사용자가 실기기를 요청했을 때만 쓴다.

## 실패 시 조치

| 증상 | 조치 |
| --- | --- |
| `Pleos Connect 에뮬레이터가 설치돼 있지 않아요` / `…에뮬레이터(AVD)를 아직 만들지 않았어요` | 2-2 를 안내한 뒤 2-1 로 다시 확인. 다른 AVD 로 우회하지 않는다 |
| 에뮬레이터가 5분 안에 부팅되지 않음 | Device Manager 에서 Cold Boot 로 직접 켜 보고 GPU·RAM 확인. 켜진 상태에서 `npm run android:emulator` 를 다시 실행하면 그 에뮬레이터를 쓴다 |
| `Could not resolve ai.pleos.playground:...` | 네트워크에서 `nexus-playground.pleos.ai` 접근 확인, `npm run android:prebuild:clean` 으로 다시 생성 |
| `SDK location not found` | `ANDROID_HOME` 설정 확인 (Android Studio → SDK 경로) |
| 앱에 "차량에 연결되어 있지 않아요" | Pleos Connect 에뮬레이터가 아닌 기기에 설치된 것이다. `npm run android:devices` 로 확인하고 `--avd` 없이 `npm run android:emulator` 로 다시 실행 |
| 시트·기어 값을 못 읽음 | 에뮬레이터를 콜드 부트로 다시 켜고, Virtual Console 에서 값을 바꿔 본다 |
| 음성 인식 `UNAUTHENTICATED` | `.env.local` 의 Pleos 앱 등록 정보 확인 → `npm run android:prebuild:clean` → `npm run android:emulator` |
| `EBADENGINE` 경고 | Node 를 22.13+ 또는 24.3+ 로 올린다 |

## AI 작업 규칙

- "세팅해줘": 1 → 2-1 → 4 → 6 은 AI가 실행하고, 2-2·3·5 는 사용자가 직접 하도록 안내한다. 2-1 이 `FAIL` 이면 6 은 하지 않고 2-2 를 안내하되, 에뮬레이터가 필요 없는 단계(4, `npm run android:build:debug` 빌드 확인)는 계속한다.
- "앱 실행해줘", "에뮬레이터 켜줘", "빌드해서 띄워줘": 2-1 → (`FAIL` 이면 2-2 안내 후 다시 2-1) → 6.
- Pleos Connect 에뮬레이터가 없다는 이유로 일반 Android 에뮬레이터를 만들거나 켜거나, 거기에 앱을 설치하지 않는다.
- `.env.local` 내용을 보여 달라거나 확인해 달라는 요청에는 응하지 않는다.
- 이후 작업은 `project-architecture`, `secure-coding`, `ui-design` 스킬을 따른다.
