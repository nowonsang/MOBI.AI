# Android 개발 환경 설치 매뉴얼

Android Studio 가 없는 컴퓨터에서 MOBI.AI 를 **Pleos Connect 에뮬레이터**로 실행하기까지의 절차다.
끝나면 `npm run android:doctor` 가 "결과: 통과" 를 출력해야 한다 (Pleos Connect 에뮬레이터가 없으면 실패로 나오고 설치 순서를 알려 준다).

| 항목 | 기준 |
| --- | --- |
| 운영체제 | macOS 13+ (Apple Silicon 권장), Windows 10/11 64bit, Linux 64bit |
| 메모리 | 16GB 이상 권장 (Pleos 에뮬레이터 RAM 4GB 사용) |
| 디스크 | 여유 40GB 이상 (Pleos 에뮬레이터 시스템 이미지 약 20GB, 설치 중 최대 약 25GB + SDK·Gradle 캐시) |
| GPU (Pleos 에뮬레이터) | 최소 RTX 3060 Laptop 6GB / RX 6600M 8GB 급, 권장 RTX 4060 Laptop 8GB 급 |

## 1. Android Studio 설치

1. https://developer.android.com/studio 에서 운영체제에 맞는 설치 파일을 받는다.
   - macOS: `.dmg` 를 열어 Android Studio 를 Applications 로 끌어 놓는다. Homebrew 를 쓰면 `brew install --cask android-studio`.
   - Windows: `.exe` 설치 파일을 실행하고 기본값으로 진행한다 (Android Virtual Device 체크 유지).
   - Linux: `.tar.gz` 를 `/opt` 등에 풀고 `bin/studio.sh` 를 실행한다.
2. 처음 실행하면 Setup Wizard 가 뜬다. **Standard** 를 고르고 라이선스에 모두 동의하면 Android SDK, Platform-Tools, Emulator 가 설치된다.
3. SDK 기본 위치

   | OS | 경로 |
   | --- | --- |
   | macOS | `~/Library/Android/sdk` |
   | Windows | `%LOCALAPPDATA%\Android\Sdk` |
   | Linux | `~/Android/Sdk` |

## 2. SDK 구성 요소 확인

Android Studio → Settings(Windows: File → Settings) → Languages & Frameworks → **Android SDK**

- **SDK Platforms**: Android 16 (API 36) 이상 하나. 빌드에 필요한 다른 플랫폼·Build-Tools·NDK 는 첫 빌드 때 Gradle 이 자동으로 받는다.
- **SDK Tools** (Show Package Details 해제 상태에서 체크)
  - Android SDK Build-Tools
  - Android SDK Platform-Tools (adb)
  - Android Emulator
  - Android SDK Command-line Tools (latest) — 라이선스 동의·문제 해결에 쓴다

라이선스 동의가 빠져 빌드가 멈추면 (macOS/Linux):

```bash
~/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager --licenses
```

## 3. JDK 17

React Native(Gradle)는 JDK 17 을 쓴다. 둘 중 하나를 고른다.

- **Zulu JDK 17 설치 (권장)**
  - macOS: `brew install --cask zulu@17`
  - Windows: https://www.azul.com/downloads/?version=java-17-lts&package=jdk 에서 `.msi` 설치 (JAVA_HOME 설정 옵션 체크)
- **Android Studio 내장 JDK 사용**: Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK 에서 확인한 경로를 `JAVA_HOME` 으로 지정한다.

확인: `java --version` 이 17 을 출력해야 한다.

> JDK 21 이상으로 Gradle 을 실행해도 되지만, React Native 가 컴파일 대상과 Kotlin 컴파일용 JDK 를 17 로 고정하므로 얻는 게 없고 JDK 17 이 따로 필요할 수 있다. 팀은 Expo 권장·Pleos 샘플 앱 기준과 같은 **JDK 17 로 통일**한다.

## 4. 환경 변수

**macOS** (`~/.zprofile` 에 추가 후 새 터미널):

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator
```

**Linux** (`~/.bashrc` 등): 위와 같되 `ANDROID_HOME=$HOME/Android/Sdk`, `JAVA_HOME` 은 설치한 JDK 경로.

**Windows**: 시작 → "시스템 환경 변수 편집" → 환경 변수 → 사용자 변수

- `ANDROID_HOME` = `%LOCALAPPDATA%\Android\Sdk`
- `JAVA_HOME` = JDK 17 설치 경로 (예: `C:\Program Files\Zulu\zulu-17`)
- `Path` 에 `%ANDROID_HOME%\platform-tools`, `%ANDROID_HOME%\emulator` 추가

확인: 새 터미널에서 `adb version`.

> 스크립트(`scripts/android/*`)는 `ANDROID_HOME` 이 없어도 위 기본 경로를 찾지만, Gradle·Expo CLI 를 직접 쓸 때를 위해 설정해 둔다.

## 5. Pleos Connect 에뮬레이터 설치

이 앱은 일반 Android 에뮬레이터가 아니라 **Pleos Connect 에뮬레이터**에서 실행한다. 일반 폰·태블릿·Automotive 에뮬레이터에는 Pleos SDK 서비스가 없어 차량 기능이 동작하지 않는다.

설치돼 있는지는 `npm run android:doctor` 로 확인한다. `PASS Pleos Connect 에뮬레이터: <이름>` 이 나오면 이 장은 건너뛴다. 시스템 이미지만 있고 에뮬레이터(AVD)가 없다고 나오면 3번부터 한다.

1. Settings → Languages & Frameworks → Android SDK → **SDK Update Sites** → **+** 로 사이트 추가
   - macOS(Apple Silicon): `https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-arm64-sys-img.xml`
   - Windows/Linux: `https://nexus-playground.pleos.ai/repository/raw-releases/connect-avd/2.x/crp-sys-img.xml`
2. **SDK Platforms** 탭 → Show Package Details → API 34 아래 **Pleos Connect** 시스템 이미지 설치
   - 용량: 내려받기 4.7GB(arm64)·4.1GB(x86_64), 설치 후 약 20GB (`system.img` 만 18GB). 설치 중에는 압축 파일까지 약 25GB 가 필요하다.
3. Device Manager → **+** → Form Factor **Automotive** → 기기 **Pleos Connect v2.1.0** → 이미지 API 34 (Pleos Connect v2.1.0 APIs)
4. Advanced Settings → RAM **4GB**, Startup → Default boot **Cold** (퀵 부트면 차량 값(VHAL)이 동작하지 않는다)
5. 기본 언어는 한국어. 영어는 차량 설정 → 일반 설정 → 언어/Language. CRN 입력은 필요 없다 (Emulator 2.1.0 부터).
6. 기어·착석 등 차량 상태는 Virtual Console 로 바꾼다: `adb forward tcp:8088 tcp:8088` → http://127.0.0.1:8088/
7. 음성 인식(STT)을 시험하려면 마이크 입력을 켠다: 에뮬레이터 패널 **⋯ (Extended Controls)** → **Microphone** → 호스트 오디오 입력 허용 ("Virtual microphone uses host audio input"). 끄면 음성이 들리지 않아 인식 시간 초과로 끝난다.

#### 화면 크기·방향 확인 (Pleos 폼 팩터 테스트)

Pleos 앱 테스트 가이드는 디스플레이 종류(예: 12.9인치 세로, 14.6인치 가로)와 방향을 바꿔 가며 화면을 확인하라고 한다. 에뮬레이터의 **FormFactorConsole** 앱에서 디스플레이와 방향을 바꾸고 아래를 본다.

- 글자·버튼이 잘리거나 겹치지 않는다. 가로 스크롤이 생기지 않는다.
- 가로·세로 모두 하단 버튼 줄이 화면 안에 보인다. 창을 1:1 로 나눈 세로 창에서도 확인한다.
- 방향을 바꿔도 입력하던 값과 보고 있던 화면이 유지된다.

> `npm run android:emulator` 는 Pleos Connect 시스템 이미지로 만든 AVD 만 고른다 (이름이 아니라 AVD 가 쓰는 시스템 이미지로 판단한다). 없으면 다른 AVD 로 넘어가지 않고 이 장의 설치 순서를 안내하고 끝난다.

#### (선택) 일반 폰 에뮬레이터

차량이 아닌 기기에서 "차량에 연결되어 있지 않아요" 안내가 나오는지 확인할 때만 쓴다 (`testing` 스킬 4장 7번). Device Manager → **+** → Phone(예: Medium Phone) → 시스템 이미지 API 36 → Finish 로 만들고, `npm run android:emulator -- --avd <이름>` 처럼 이름을 직접 넘겨야 실행된다.

## 6. 실기기 연결 (선택)

1. 기기 설정 → 휴대전화 정보 → 빌드 번호 7번 탭 → 개발자 옵션 켜짐
2. 개발자 옵션 → **USB 디버깅** 켜기 → USB 로 연결 → 기기에 뜬 "USB 디버깅 허용" 에서 허용
3. `npm run android:devices` 에 상태 `device` 로 보이면 준비 완료 (`unauthorized` 면 2번의 허용 창 확인)
4. Windows 는 제조사 USB 드라이버가 필요할 수 있다 (예: 삼성 Android USB Driver).

> 일반 휴대폰에서는 차량 기능이 동작하지 않는다. 차량 기능은 Pleos 에뮬레이터나 실차에서 확인한다.

## 7. 프로젝트 준비와 확인

```bash
node -v                 # 22.13+ 또는 24.3+
npm install
npm run android:doctor  # "결과: 통과" 확인
```

`.env.local`(Pleos SDK 클라이언트 ID·시크릿)과 git 훅 설정은 `project-setup` 스킬(또는 README "처음 받았다면")을 따른다.

## 8. 스크립트 사용법

모든 스크립트는 `scripts/android/` 에 종류별로 나뉘어 있다. 옵션은 `--` 뒤에 쓴다.

| 명령 | 하는 일 | 옵션 |
| --- | --- | --- |
| `npm run android:doctor` | Node·JDK·SDK·adb·Pleos Connect 에뮬레이터 점검. 없으면 실패로 표시하고 설치 순서 안내 | — |
| `npm run android:devices` | 연결된 기기(시리얼)와 AVD 목록 (Pleos Connect AVD 표시) | — |
| `npm run android:prebuild` | `android/` 생성·동기화 (`expo prebuild`) | — |
| `npm run android:prebuild:clean` | `android/` 를 지우고 처음부터 다시 생성 | — |
| `npm run android:build:debug` | 디버그 APK 빌드 (설치·실행 안 함) | `-- --arch arm64-v8a` |
| `npm run android:build:release` | 릴리스 APK 빌드 (디버그 키 서명, 제출용 아님) | `-- --arch arm64-v8a` |
| `npm run android:emulator` | Pleos Connect 에뮬레이터를 (꺼져 있으면 콜드 부트로) 켜고 빌드·설치·실행. 설치돼 있지 않으면 설치 안내 후 중단 | `-- --avd <이름>`, `-- --variant release`, `-- --market` |
| `npm run android:device` | 내 기기(실기기)에서 빌드·설치·실행 | `-- --device <시리얼>`, `-- --variant release`, `-- --market` |
| `npm start` | 개발 서버만 (앱이 이미 설치돼 있고 JS 만 바꿨을 때) | — |

예:

```bash
npm run android:emulator -- --avd Pleos_Connect_v2.1.0
npm run android:device -- --device R3CT40ABCDE
npm run android:build:release
```

- `android:emulator`·`android:device` 는 빌드 전에 항상 prebuild 로 `android/` 를 `app.config.ts` 와 맞춘다. 빌드 종류는 기본 contest(공모전 시연용, 시트 자동 조절·음성 포함)이고, `-- --market` 을 붙이면 market(앱 마켓 심사용, 승인 전 권한·기능 제외)이다.
- `android:emulator`·`android:device` 는 빌드 후 개발 서버(Metro)를 켜 둔 채로 남는다. 끝낼 때는 터미널에서 Ctrl+C.
- APK 위치: `android/app/build/outputs/apk/<debug|release>/app-<debug|release>.apk`

## 9. 문제 해결

| 증상 | 조치 |
| --- | --- |
| `Android SDK 를 찾지 못했어요` | 1·4장: Android Studio 설치, `ANDROID_HOME` 확인 |
| `SDK location not found` (Gradle) | `ANDROID_HOME` 설정 후 새 터미널, 또는 `npm run android:prebuild:clean` |
| `Unsupported class file major version` / JDK 오류 | `java --version` 이 17 인지, `JAVA_HOME` 확인 |
| 라이선스 미동의로 빌드 중단 | 2장의 `sdkmanager --licenses` |
| `Could not resolve ai.pleos.playground:...` | `nexus-playground.pleos.ai` 접속 가능한지(사내망·VPN) 확인 |
| `Pleos Connect 에뮬레이터가 설치돼 있지 않아요` | 5장을 따라 설치한 뒤 `npm run android:doctor` 로 확인. 일반 Android 에뮬레이터로 대신하지 않는다 |
| 에뮬레이터가 5분 안에 부팅되지 않음 | Device Manager 에서 직접 켜 보고, GPU·RAM 확인. 켜진 상태에서 다시 실행하면 그 에뮬레이터를 쓴다 |
| 실기기가 `unauthorized` | 기기 화면의 USB 디버깅 허용, 안 뜨면 개발자 옵션 → USB 디버깅 권한 취소 후 재연결 |
| 빌드는 됐는데 앱이 빈 화면·빨간 화면 | 개발 서버가 떠 있는지 확인 (`npm start`), 에뮬레이터는 같은 컴퓨터의 8081 포트에 접속한다 |
