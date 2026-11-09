import type { ConfigContext, ExpoConfig } from "expo/config";
import { type ConfigPlugin, withAppBuildGradle } from "expo/config-plugins";

// Pleos Connect SDK 요구 사항: Android API 28 이상, Pleos 전용 Maven 저장소.
// android/ 폴더는 prebuild 가 이 설정으로 매번 다시 만든다 (직접 수정 금지, .gitignore 대상).
const PLEOS_MAVEN_REPO =
  "https://nexus-playground.pleos.ai/repository/maven-releases/";

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

export default ({ config }: ConfigContext): ExpoConfig =>
  withReleaseSigning({
    ...config,
    name: "MOBI.AI",
    slug: "mobi-ai",
    version: "0.1.0",
    scheme: "mobiai",
    platforms: ["android"],
    orientation: "default",
    userInterfaceStyle: "light",
    icon: "./assets/images/icon.png",
    android: {
      package: "ai.mobi.app",
      // Pleos 앱 버전 관리 정책: 심사 요청·배포 때마다 반드시 올린다 (version 과 함께).
      versionCode: 1,
      // Pleos 앱 보안 가이드: 자동 백업 비활성화 권장 (체형 정보가 기기 밖으로 나가지 않게).
      allowBackup: false,
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#FFFFFF",
          image: "./assets/images/splash-icon.png",
          imageWidth: 76,
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 28,
            extraMavenRepos: [PLEOS_MAVEN_REPO],
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
