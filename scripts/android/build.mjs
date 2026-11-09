#!/usr/bin/env node
// APK 빌드: `npm run android:build:debug`, `npm run android:build:release`
// 옵션: --arch arm64-v8a  (C++ 를 한 CPU 구조만 빌드해 빠르게. 컴파일 확인용으로 verify 가 쓴다)
//       --market          (Pleos 앱 마켓 심사용: 승인 전 권한·기능 제외. 기본은 공모전 시연용 contest)
// 설치·실행은 하지 않는다. 에뮬레이터·실기기 실행은 android:emulator / android:device.

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { androidDir, capture, childEnv, expo, run, sdkRoot } from "./lib.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { arch: { type: "string" }, market: { type: "boolean", default: false } },
});

const variant = positionals[0] ?? "debug";
if (!["debug", "release"].includes(variant)) {
  console.error("사용법: node scripts/android/build.mjs <debug|release> [--arch arm64-v8a] [--market]");
  process.exit(1);
}

childEnv.MOBI_APP_VARIANT = values.market ? "market" : (childEnv.MOBI_APP_VARIANT ?? "contest");
console.log(`빌드 종류: ${childEnv.MOBI_APP_VARIANT}`);

// android/ 를 app.config.ts 와 맞춘다 (없으면 만든다).
expo(["prebuild", "--platform", "android", "--no-install"]);

const task = variant === "release" ? "assembleRelease" : "assembleDebug";
const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
run(gradlew, [task, ...(values.arch ? [`-PreactNativeArchitectures=${values.arch}`] : [])], {
  cwd: androidDir,
});

const apk = path.join(androidDir, "app", "build", "outputs", "apk", variant, `app-${variant}.apk`);
if (existsSync(apk)) console.log(`\nAPK: ${apk}`);
if (variant === "release" && existsSync(apk) && signedWithDebugKey(apk)) {
  // Pleos 앱 보안 가이드: 배포용 앱은 배포용 인증서로 서명해야 한다. 키 설정은 README 'APK 서명'.
  console.log("주의: 이 APK 는 디버그 키로 서명됐어요. 공모전·Pleos 앱 마켓 제출 전에 배포 키로 다시 빌드해 주세요 (README 'APK 서명').");
}

function signedWithDebugKey(apkPath) {
  const buildTools = path.join(sdkRoot, "build-tools");
  const latest = existsSync(buildTools) ? readdirSync(buildTools).sort().at(-1) : null;
  if (!latest) return true;
  const apksigner = path.join(buildTools, latest, process.platform === "win32" ? "apksigner.bat" : "apksigner");
  return /CN=Android Debug/.test(capture(apksigner, ["verify", "--print-certs", apkPath]));
}
