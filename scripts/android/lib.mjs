// Android 스크립트 공용 도구: SDK 경로, adb·emulator 실행, 기기 목록, 명령 실행.
// macOS·Windows·Linux 에서 같은 명령으로 동작하도록 Node 로 작성한다. 사용법은 ANDROID_SETUP.md.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const isWindows = process.platform === "win32";
const exe = (name) => (isWindows ? `${name}.exe` : name);

export const projectRoot = path.resolve(import.meta.dirname, "..", "..");
export const androidDir = path.join(projectRoot, "android");

// Android Studio 기본 설치 경로. ANDROID_HOME 이 없으면 여기서 찾는다.
function defaultSdkPath() {
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Android", "sdk");
  if (isWindows) return path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
  return path.join(os.homedir(), "Android", "Sdk");
}

export const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || defaultSdkPath();
export const adbPath = path.join(sdkRoot, "platform-tools", exe("adb"));
export const emulatorPath = path.join(sdkRoot, "emulator", exe("emulator"));

/** 하위 명령이 SDK 를 찾을 수 있게 ANDROID_HOME 을 채운 환경 변수 */
export const childEnv = { ...process.env, ANDROID_HOME: sdkRoot };

export function fail(message) {
  console.error(`\n[실패] ${message}`);
  process.exit(1);
}

export function requireSdk() {
  if (!existsSync(adbPath)) {
    fail(`Android SDK 를 찾지 못했어요 (${sdkRoot}). ANDROID_SETUP.md 의 설치 절차를 따라 주세요.`);
  }
}

/** 출력을 그대로 보여 주며 실행한다. 실패하면 스크립트를 끝낸다. */
export function run(command, args, options = {}) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: childEnv,
    // Windows 의 npx·gradlew.bat 은 셸로 실행해야 한다.
    shell: isWindows,
    ...options,
  });
  if (result.status !== 0) fail(`${command} 가 실패했어요 (종료 코드 ${result.status}).`);
}

/** 출력을 문자열로 받는다. 실패해도 끝내지 않고 빈 문자열을 돌려준다. */
export function capture(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", env: childEnv, shell: isWindows });
  return result.status === 0 ? result.stdout.trim() : "";
}

export function expo(args) {
  run("npx", ["expo", ...args], { cwd: projectRoot });
}

/** `adb devices -l` → [{ serial, state, model, emulator }] */
export function listDevices() {
  return capture(adbPath, ["devices", "-l"])
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [serial, state] = line.split(/\s+/);
      const model = line.match(/model:(\S+)/)?.[1] ?? "";
      return { serial, state, model, emulator: serial.startsWith("emulator-") };
    });
}

export function listAvds() {
  if (!existsSync(emulatorPath)) return [];
  return capture(emulatorPath, ["-list-avds"])
    .split("\n")
    .map((line) => line.trim())
    // 에뮬레이터가 경고 줄(INFO 등)을 섞어 출력하는 경우가 있다.
    .filter((line) => line && !line.includes(" "));
}

/** 실행 중인 에뮬레이터의 AVD 이름 */
export function avdNameOf(serial) {
  return capture(adbPath, ["-s", serial, "emu", "avd", "name"]).split("\n")[0]?.trim() ?? "";
}

export function printDevices(devices) {
  for (const device of devices) {
    const kind = device.emulator ? "에뮬레이터" : "실기기";
    console.log(`  ${device.serial}  ${device.state}  ${kind}  ${device.model}`);
  }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
