import type { ConfigContext, ExpoConfig } from "expo/config";

// Pleos Connect SDK 요구 사항: Android API 28 이상, Pleos 전용 Maven 저장소.
// android/ 폴더는 prebuild 가 이 설정으로 매번 다시 만든다 (직접 수정 금지, .gitignore 대상).
const PLEOS_MAVEN_REPO =
  "https://nexus-playground.pleos.ai/repository/maven-releases/";

export default ({ config }: ConfigContext): ExpoConfig => ({
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
    // .env.local 의 PLEOS_CLIENT_ID·PLEOS_CLIENT_SECRET 을 매니페스트에 넣는다 (없으면 온디바이스 모드).
    "./modules/pleos-connect/app.plugin.js",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
