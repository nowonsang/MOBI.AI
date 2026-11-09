#!/usr/bin/env node
// 연결된 기기와 만들어 둔 에뮬레이터(AVD) 목록: `npm run android:devices`
// 여기 나온 시리얼을 android:device 의 --device 에, AVD 이름을 android:emulator 의 --avd 에 넘긴다.

import { listAvds, listDevices, printDevices, requireSdk } from "./lib.mjs";

requireSdk();

const devices = listDevices();
console.log("연결된 기기 (시리얼 · 상태 · 종류 · 모델)");
if (devices.length === 0) console.log("  (없음)");
else printDevices(devices);

if (devices.some((device) => device.state === "unauthorized")) {
  console.log("\n  unauthorized: 기기 화면의 'USB 디버깅 허용' 창에서 허용을 눌러 주세요.");
}

const avds = listAvds();
console.log("\n에뮬레이터(AVD)");
console.log(avds.length === 0 ? "  (없음)" : avds.map((name) => `  ${name}`).join("\n"));
