import type { ConfigContext, ExpoConfig } from "expo/config";
import {
  AndroidConfig,
  type ConfigPlugin,
  withAndroidColorsNight,
  withAppBuildGradle,
  withGradleProperties,
} from "expo/config-plugins";

// Pleos Connect SDK 요구 사항: Android API 28 이상, Pleos 전용 Maven 저장소.
// android/ 폴더는 prebuild 가 이 설정으로 매번 다시 만든다 (직접 수정 금지, .gitignore 대상).
const PLEOS_MAVEN_REPO =
  "https://nexus-playground.pleos.ai/repository/maven-releases/";

// 릴리스 빌드의 코드 축소·난독화(R8, ProGuard 규칙)에서 지우거나 이름을 바꾸면 안 되는 것들.
// React Native·Expo 모듈·CameraX·ML Kit 은 라이브러리가 자기 규칙을 함께 배포한다. 여기에는 그렇지 않은 것만 적는다.
// - Pleos SDK: Vehicle 만 규칙이 들어 있고 NaviHelper·SpeechToText·TextToSpeech AAR 에는 없다 (2026-11-14 AAR 확인).
//   SDK 가 차량 서비스와 주고받는 클래스(AIDL·Parcelable·리플렉션)를 알 수 없어 SDK 전체를 그대로 둔다.
// - android.car: 차량 OS 가 런타임에 제공하는 클래스라 APK 에 없다. 없는 클래스 경고로 빌드가 멈추지 않게 한다.
// - 우리 네이티브 모듈(ai.mobi.**): Expo 가 이름으로 찾는 모듈·뷰·포그라운드 서비스.
const PROGUARD_RULES = `
-keep class ai.pleos.** { *; }
-keep interface ai.pleos.** { *; }
-dontwarn ai.pleos.**
-keep class android.car.** { *; }
-dontwarn android.car.**
-keep class ai.mobi.** { *; }
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class * implements com.google.firebase.components.ComponentRegistrar { <init>(); }
`;

// AGP 9 는 R8 이 "클래스를 남겨라"는 규칙만으로는 인자 없는 생성자를 남기지 않는다 (strictFullModeForKeepRules 기본 켜짐).
// 그런데 ML Kit·WorkManager(Room) 같은 라이브러리의 규칙은 생성자가 함께 남는다고 보고 쓰여 있어,
// 릴리스 앱이 시작하자마자 죽었다 (2026-11-14 Pleos 에뮬레이터: PoseRegistrar.<init>, WorkDatabase 생성 실패).
// 라이브러리들이 새 방식에 맞출 때까지 예전 방식으로 둔다. 위 두 줄은 이 속성이 없어져도 같은 문제가 나지 않게 한 것.
const R8_STRICT_KEEP_RULES = "android.r8.strictFullModeForKeepRules";
const withLenientR8KeepRules: ConfigPlugin = (config) =>
  withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter(
      (item) => item.type !== "property" || item.key !== R8_STRICT_KEEP_RULES,
    );
    mod.modResults.push({
      type: "property",
      key: R8_STRICT_KEEP_RULES,
      value: "false",
    });
    return mod;
  });

// 앱이 뜨기 전(창 바탕·시작 화면)의 색. src/shared/ui/theme.ts 의 surfaceMuted 주간·야간 값과 같게 둔다.
const DAY_BACKGROUND = "#F4F5F7";
const NIGHT_BACKGROUND = "#0E1116";

// expo-system-ui 는 창 바탕색(activityBackground)을 주간 값 하나만 받는다.
// 야간 값은 values-night 에 따로 넣어, JS 가 뜨기 전에도 야간에 밝은 면이 보이지 않게 한다.
const withNightWindowBackground: ConfigPlugin = (config) =>
  withAndroidColorsNight(config, (mod) => {
    mod.modResults = AndroidConfig.Colors.assignColorValue(mod.modResults, {
      name: "activityBackground",
      value: NIGHT_BACKGROUND,
    });
    return mod;
  });

// contest: 공모전 시연용 (시트 자동 조절·음성 포함). market: Pleos 앱 마켓 심사용 (승인 전 권한·기능 제외).
const APP_VARIANTS = ["contest", "market"] as const;
type AppVariant = (typeof APP_VARIANTS)[number];

function appVariant(): AppVariant {
  const value = process.env.MOBI_APP_VARIANT ?? "contest";
  if (!APP_VARIANTS.includes(value as AppVariant)) {
    throw new Error(
      `MOBI_APP_VARIANT 는 ${APP_VARIANTS.join(" | ")} 중 하나여야 해요 (현재: ${value})`,
    );
  }
  return value as AppVariant;
}

// Pleos 앱 보안 가이드: 배포용 앱은 디버그 인증서가 아닌 배포용 인증서로 서명한다 (minSdk 28: v3 서명·키 로테이션).
// 키 위치·비밀번호는 Gradle 속성(~/.gradle/gradle.properties 또는 ORG_GRADLE_PROJECT_* 환경 변수)에서만 읽어
// android/ 와 저장소에 남지 않게 한다. 속성이 없으면 지금처럼 디버그 키로 서명한다 (빌드 스크립트가 경고).
const withReleaseSigning: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes("signingConfigs.mobiRelease"))
      return mod;
    mod.modResults.contents = mod.modResults.contents
      .replace(
        /signingConfigs \{/,
        `signingConfigs {
        mobiRelease {
            if (findProperty('MOBI_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('MOBI_UPLOAD_STORE_FILE'))
                storePassword findProperty('MOBI_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('MOBI_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('MOBI_UPLOAD_KEY_PASSWORD')
                enableV2Signing true
                enableV3Signing true
            }
        }`,
      )
      .replace(
        /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
        "$1signingConfig findProperty('MOBI_UPLOAD_STORE_FILE') ? signingConfigs.mobiRelease : signingConfigs.debug",
      );
    return mod;
  });

const appConfig = ({ config }: ConfigContext): ExpoConfig =>
  withReleaseSigning({
    ...config,
    name: "MOBI.AI",
    slug: "mobi-ai",
    version: "0.1.0",
    scheme: "mobiai",
    platforms: ["android"],
    orientation: "default",
    // 차량의 주간·야간 상태(시스템 다크 모드)를 따른다. Android 에서는 expo-system-ui 가 있어야 적용된다.
    userInterfaceStyle: "automatic",
    backgroundColor: DAY_BACKGROUND,
    icon: "./assets/images/icon.png",
    android: {
      package: "ai.mobi.app",
      // Pleos 앱 버전 관리 정책: 심사 요청·배포 때마다 반드시 올린다 (version 과 함께).
      versionCode: 1,
      // Pleos 앱 보안 가이드: 자동 백업 비활성화 권장 (체형 정보가 기기 밖으로 나가지 않게).
      allowBackup: false,
      adaptiveIcon: {
        // theme.ts 의 colors.primary. 아이콘 배경 이미지와 같은 색이다.
        backgroundColor: "#1570EF",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
      // CAMERA: 세 곳에 쓴다. 운전자 등록의 "카메라로 재기", "QR 로 가져오기"의 "카메라로 읽기",
      // 그리고 운전자가 동의한 주행 자세 관찰(C-7, 아래 FOREGROUND_SERVICE). 앞의 두 곳은
      // 주차 중 운전자가 버튼을 눌렀을 때만 켜고, 화면 한 장을 기기 안에서 분석해 관절 위치(앉은키 추정)나
      // QR 코드의 글자(다른 차에서 만든 프로필 코드)만 읽는다. 영상·사진은 저장하지도 밖으로 보내지도 않는다
      // (modules/pose-camera). 권한 창도 처음 쓸 때 띄우고, 거부해도 직접 입력으로 등록할 수 있다.
      // Pleos 앱 마켓과 협의하지 않은 기능이라 market 빌드에서는 권한을 선언하지 않는다 (화면도 숨긴다: app-variant.ts).
      // FOREGROUND_SERVICE·FOREGROUND_SERVICE_CAMERA: 주행 중 자세 관찰(C-7). 주행 중에는 앱 화면이 가려져
      // 화면 없이 도는 카메라 서비스가 필요하다. 운전자가 켠 경우에만 주차 중에 시작하고, 관절 좌표만 기기 안에 남긴다.
      permissions:
        appVariant() === "market"
          ? []
          : [
              "android.permission.CAMERA",
              "android.permission.FOREGROUND_SERVICE",
              "android.permission.FOREGROUND_SERVICE_CAMERA",
            ],
      // 최소 권한: Expo 기본 템플릿이 넣지만 이 앱이 쓰지 않는 권한을 매니페스트에서 뺀다 (tools:node="remove").
      // 외부 저장소 읽기·쓰기(체형 정보는 앱 전용 암호화 저장소에만 둔다), 다른 앱 위에 그리기, 진동.
      // INTERNET 은 남긴다: 개발 빌드가 Metro 에서 JS 를 받아 오고, Pleos STT·TTS 의 서버 모드가 쓴다.
      // 앱 코드가 직접 보내는 네트워크 요청은 없다 (SECURITY.md).
      blockedPermissions: [
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.VIBRATE",
        // expo-secure-store 가 함께 선언하는 생체 인증 권한. 암호화 키를 읽을 때 생체 인증을 요구하지 않으므로
        // (requireAuthentication 을 쓰지 않는다) 필요 없다.
        "android.permission.USE_BIOMETRIC",
        "android.permission.USE_FINGERPRINT",
      ],
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#FFFFFF",
          image: "./assets/images/splash-icon.png",
          dark: {
            backgroundColor: NIGHT_BACKGROUND,
            image: "./assets/images/splash-icon.png",
          },
          imageWidth: 76,
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 28,
            extraMavenRepos: [PLEOS_MAVEN_REPO],
            // 릴리스 APK 는 R8 로 안 쓰는 코드·리소스를 빼고 이름을 줄인다 (디버그 빌드는 그대로).
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            extraProguardRules: PROGUARD_RULES,
          },
        },
      ],
      "expo-sqlite",
      // 체형 정보 암호화 키를 Android Keystore 로 보호해 보관한다 (src/shared/storage/encrypted-storage.ts).
      "expo-secure-store",
      // .env.local 의 PLEOS_CLIENT_ID·PLEOS_CLIENT_SECRET 을 매니페스트에 넣는다 (없으면 온디바이스 모드).
      // market 빌드는 승인 전 Pleos 권한(시트 제어·STT·TTS)을 매니페스트에서 뺀다.
      ["./modules/pleos-connect/app.plugin.js", { variant: appVariant() }],
    ],
    // 비밀 값이 아니다. JS 가 market 빌드에서 승인 전 기능의 화면을 숨기는 데 쓴다 (src/shared/config/app-variant.ts).
    extra: { ...config.extra, appVariant: appVariant() },
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
  });

export default (context: ConfigContext): ExpoConfig =>
  withLenientR8KeepRules(withNightWindowBackground(appConfig(context)));
