#!/usr/bin/env node
// Pleos Connect 에뮬레이터에서 빌드·설치·실행: `npm run android:emulator`
// 이 앱의 실행 대상은 일반 Android 에뮬레이터가 아니라 Pleos Connect 에뮬레이터다.
//   1) Pleos Connect 에뮬레이터(AVD)가 없으면 설치 방법을 안내하고 끝낸다. 다른 AVD 로 대신 실행하지 않는다.
//   2) 꺼져 있으면 콜드 부트로 켜고 부팅이 끝날 때까지 기다린다. 이미 켜져 있으면 그대로 쓴다.
//   3) `expo run:android --device <시리얼>` 로 빌드·설치·실행한다.
// 옵션: --avd <이름>             AVD 를 직접 고른다. Pleos Connect AVD 가 여러 개일 때,
//                                또는 차량이 아닌 기기의 안내 화면을 확인할 때(일반 AVD)만 쓴다.
//       --variant <debug|release> 빌드 종류 (기본 debug)

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
  isPleosAvd,
  listAvds,
  listDevices,
  listPleosAvds,
  pleosInstallGuide,
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

/** 실행 대상이 될 수 있는 AVD 이름들. --avd 가 없으면 Pleos Connect AVD 만 대상이다. */
function targetAvds() {
  if (values.avd) {
    const avds = listAvds();
    if (!avds.includes(values.avd)) {
      fail(`AVD '${values.avd}' 가 없어요. 있는 AVD: ${avds.join(", ") || "(없음)"}`);
    }
    if (!isPleosAvd(values.avd)) {
      console.log(
        `\n[주의] '${values.avd}' 는 Pleos Connect 에뮬레이터가 아니에요. 차량 기능(시트·기어·음성)은 동작하지 않아요.`,
      );
    }
    return [values.avd];
  }
  const guide = pleosInstallGuide();
  if (guide) fail(guide);
  return listPleosAvds();
}

async function waitForBoot(before) {
  console.log("Pleos Connect 에뮬레이터를 켜는 중이에요 (콜드 부트는 1~3분 걸려요)...");
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
  const avds = targetAvds();
  // 켜져 있는 에뮬레이터 중 대상 AVD 만 쓴다. 일반 Android 에뮬레이터가 켜져 있어도 거기에는 설치하지 않는다.
  const match = running().find((device) => avds.includes(avdNameOf(device.serial)));
  if (match) return match.serial;

  // Pleos Connect 에뮬레이터는 퀵 부트면 VHAL(차량 값)이 동작하지 않아 항상 콜드 부트로 켠다.
  const [avd] = avds;
  console.log(`\nAVD '${avd}' 를 켭니다.`);
  const before = new Set(listDevices().map((device) => device.serial));
  const child = spawn(emulatorPath, ["-avd", avd, "-no-snapshot-load"], {
    detached: true,
    stdio: "ignore",
    env: childEnv,
  });
  child.unref();
  return waitForBoot(before);
}

const serial = await resolveEmulator();
console.log(`\n대상 에뮬레이터: ${serial} (${avdNameOf(serial)})`);
expo(["run:android", "--device", serial, "--variant", values.variant]);
