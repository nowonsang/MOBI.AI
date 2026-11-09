#!/usr/bin/env node
// APK 빌드: `npm run android:build:debug`, `npm run android:build:release`
// 옵션: --arch arm64-v8a  (C++ 를 한 CPU 구조만 빌드해 빠르게. 컴파일 확인용으로 verify 가 쓴다)
// 설치·실행은 하지 않는다. 에뮬레이터·실기기 실행은 android:emulator / android:device.

import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { androidDir, expo, run } from "./lib.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { arch: { type: "string" } },
});

const variant = positionals[0] ?? "debug";
if (!["debug", "release"].includes(variant)) {
  console.error("사용법: node scripts/android/build.mjs <debug|release> [--arch arm64-v8a]");
  process.exit(1);
}

// android/ 를 app.config.ts 와 맞춘다 (없으면 만든다).
expo(["prebuild", "--platform", "android", "--no-install"]);

const task = variant === "release" ? "assembleRelease" : "assembleDebug";
const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
run(gradlew, [task, ...(values.arch ? [`-PreactNativeArchitectures=${values.arch}`] : [])], {
  cwd: androidDir,
});

const apk = path.join(androidDir, "app", "build", "outputs", "apk", variant, `app-${variant}.apk`);
if (existsSync(apk)) console.log(`\nAPK: ${apk}`);
if (variant === "release") {
  // Expo 기본 설정은 릴리스도 디버그 키로 서명한다. Pleos 앱 마켓 제출에는 배포용 키 서명이 필요하다.
  console.log("주의: 이 APK 는 디버그 키로 서명됐어요. Pleos 앱 마켓 제출용이 아니에요 (README 'Pleos Playground').");
}
