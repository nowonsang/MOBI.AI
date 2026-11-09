#!/usr/bin/env node
// 에뮬레이터에서 빌드·설치·실행: `npm run android:emulator`
// 옵션: --avd <이름>             에뮬레이터 선택 (없으면 실행 중인 것 → Pleos/Automotive → 첫 번째 AVD 순)
//       --variant <debug|release> 빌드 종류 (기본 debug)
// 에뮬레이터가 꺼져 있으면 콜드 부트로 켜고 부팅이 끝날 때까지 기다린 뒤 `expo run:android --device <시리얼>` 을 실행한다.

import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

import {
  adbPath,
  avdNameOf,
  capture,
  childEnv,
  emulatorPath,
  expo,
  fail,
  listAvds,
  listDevices,
  requireSdk,
  sleep,
} from "./lib.mjs";

const { values } = parseArgs({
  options: {
    avd: { type: "string" },
    variant: { type: "string", default: "debug" },
  },
});

requireSdk();

const running = () => listDevices().filter((device) => device.emulator && device.state === "device");

function pickAvd() {
  const avds = listAvds();
  if (avds.length === 0) fail("만든 에뮬레이터(AVD)가 없어요. ANDROID_SETUP.md 5장을 따라 만들어 주세요.");
  if (values.avd) {
    if (!avds.includes(values.avd)) fail(`AVD '${values.avd}' 가 없어요. 있는 AVD: ${avds.join(", ")}`);
    return values.avd;
  }
  return avds.find((name) => /pleos|automotive/i.test(name)) ?? avds[0];
}

async function waitForBoot(before) {
  console.log("에뮬레이터를 켜는 중이에요 (콜드 부트는 1~3분 걸려요)...");
  const deadline = Date.now() + 5 * 60_000;
  let serial = null;
  while (Date.now() < deadline) {
    serial ??= listDevices().find((device) => device.emulator && !before.has(device.serial))?.serial ?? null;
    if (serial && capture(adbPath, ["-s", serial, "shell", "getprop", "sys.boot_completed"]) === "1") {
      return serial;
    }
    await sleep(3000);
  }
  return fail("에뮬레이터가 5분 안에 부팅되지 않았어요. Android Studio Device Manager 에서 직접 켜 보세요.");
}

async function resolveEmulator() {
  const already = running();
  // --avd 가 없으면 이미 켜진 에뮬레이터를 그대로 쓴다.
  if (!values.avd && already.length > 0) return already[0].serial;
  const avd = pickAvd();
  const match = already.find((device) => avdNameOf(device.serial) === avd);
  if (match) return match.serial;

  // Pleos Connect 에뮬레이터는 퀵 부트면 VHAL(차량 값)이 동작하지 않아 항상 콜드 부트로 켠다.
  console.log(`\nAVD '${avd}' 를 켭니다.`);
  const child = spawn(emulatorPath, ["-avd", avd, "-no-snapshot-load"], {
    detached: true,
    stdio: "ignore",
    env: childEnv,
  });
  child.unref();
  return waitForBoot(new Set(listDevices().map((device) => device.serial)));
}

const serial = await resolveEmulator();
console.log(`\n대상 에뮬레이터: ${serial} (${avdNameOf(serial)})`);
expo(["run:android", "--device", serial, "--variant", values.variant]);
