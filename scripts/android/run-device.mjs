#!/usr/bin/env node
// 내 기기(USB·무선 디버깅으로 연결한 실기기)에서 빌드·설치·실행: `npm run android:device`
// 옵션: --device <시리얼>          기기가 여러 대면 필수 (`npm run android:devices` 로 확인)
//       --variant <debug|release> Gradle 빌드 종류 (기본 debug)
//       --market                  Pleos 앱 마켓 심사용 빌드 (승인 전 권한·기능 제외). 기본은 공모전 시연용 contest
// 빌드 전에 android/ 를 app.config.ts 와 맞춘다(prebuild).

import { parseArgs } from "node:util";

import { expo, fail, listDevices, prebuildAndroid, printDevices, requireSdk } from "./lib.mjs";

const { values } = parseArgs({
  options: {
    device: { type: "string" },
    variant: { type: "string", default: "debug" },
    market: { type: "boolean", default: false },
  },
});

requireSdk();

const physical = listDevices().filter((device) => !device.emulator);

if (physical.some((device) => device.state === "unauthorized")) {
  console.log("허용되지 않은 기기가 있어요. 기기 화면의 'USB 디버깅 허용' 창에서 허용을 눌러 주세요.");
}

const ready = physical.filter((device) => device.state === "device");
if (ready.length === 0) {
  fail("연결된 실기기가 없어요. 개발자 옵션 → USB 디버깅을 켜고 USB 로 연결해 주세요 (ANDROID_SETUP.md 6장).");
}

let target = ready[0];
if (values.device) {
  target = ready.find((device) => device.serial === values.device);
  if (!target) {
    console.log("연결된 실기기:");
    printDevices(ready);
    fail(`'${values.device}' 기기를 찾지 못했어요.`);
  }
} else if (ready.length > 1) {
  console.log("실기기가 여러 대예요. --device 로 하나를 골라 주세요:");
  printDevices(ready);
  fail("예: npm run android:device -- --device <시리얼>");
}

console.log(`\n대상 기기: ${target.serial} (${target.model})`);
prebuildAndroid({ market: values.market });
expo(["run:android", "--device", target.serial, "--variant", values.variant]);
