#!/usr/bin/env node
// Android 개발 환경 점검: `npm run android:doctor`
// Node·JDK·Android SDK·adb·Pleos Connect 에뮬레이터가 준비됐는지 확인한다. 아무것도 설치·변경하지 않는다.

import { existsSync } from "node:fs";

import { adbPath, capture, emulatorPath, listPleosAvds, pleosInstallGuide, sdkRoot } from "./lib.mjs";

let failures = 0;
const pass = (message) => console.log(`PASS ${message}`);
const warn = (message) => console.log(`WARN ${message}`);
const fail = (message) => {
  failures += 1;
  console.log(`FAIL ${message}`);
};

// Expo SDK 58 요구 사항
const [major, minor] = process.versions.node.split(".").map(Number);
if ((major === 22 && minor >= 13) || (major === 24 && minor >= 3) || major >= 25) {
  pass(`Node ${process.versions.node}`);
} else {
  warn(`Node ${process.versions.node} — Expo SDK 58 은 22.13+ 또는 24.3+ 를 요구해요`);
}

// `java --version`(JDK 9+)은 버전을 stdout 으로 출력한다.
const javaVersion = capture("java", ["--version"]).split("\n")[0];
if (!javaVersion) {
  fail("JDK 가 없어요 — JDK 17 을 설치하고 JAVA_HOME 을 설정해 주세요 (ANDROID_SETUP.md 3장)");
} else if (/\b(17|21)\./.test(javaVersion)) {
  pass(`JDK: ${javaVersion}`);
} else {
  warn(`JDK: ${javaVersion} — JDK 17 을 권장해요`);
}

if (existsSync(sdkRoot)) pass(`Android SDK: ${sdkRoot}`);
else fail(`Android SDK 가 없어요 (${sdkRoot}) — Android Studio 를 설치해 주세요 (ANDROID_SETUP.md 1장)`);

if (!process.env.ANDROID_HOME) {
  warn("ANDROID_HOME 환경 변수가 없어요 — 스크립트는 기본 경로를 쓰지만 셸 설정에 추가해 두세요 (ANDROID_SETUP.md 4장)");
}

if (existsSync(adbPath)) pass(`adb: ${capture(adbPath, ["version"]).split("\n")[0]}`);
else fail("adb 가 없어요 — SDK Manager > SDK Tools 에서 Android SDK Platform-Tools 를 설치해 주세요");

if (existsSync(emulatorPath)) {
  pass("Android Emulator");
  // 이 앱의 실행 대상은 Pleos Connect 에뮬레이터다. 일반 Android AVD 만 있으면 준비되지 않은 것으로 본다.
  const guide = pleosInstallGuide();
  if (guide) fail(guide);
  else pass(`Pleos Connect 에뮬레이터: ${listPleosAvds().join(", ")}`);
} else {
  fail("Android Emulator 가 없어요 — SDK Manager > SDK Tools 에서 Android Emulator 를 설치해 주세요");
}

console.log(`\n${failures === 0 ? "결과: 통과" : `결과: 실패 ${failures}건`}`);
process.exit(failures === 0 ? 0 : 1);
