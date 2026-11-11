// Android 스크립트 공용 도구: SDK 경로, adb·emulator 실행, 기기 목록, 명령 실행.
// macOS·Windows·Linux 에서 같은 명령으로 동작하도록 Node 로 작성한다. 사용법은 ANDROID_SETUP.md.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

/** 기기에서 지금 화면을 쓰는 Android 사용자 번호. 읽지 못하면 "0". */
export function currentUserOf(serial) {
  const user = capture(adbPath, ["-s", serial, "shell", "am", "get-current-user"]);
  return /^\d+$/.test(user) ? user : "0";
}

/**
 * `expo run:android` 로 빌드·설치·실행한다.
 * Expo CLI 는 기본으로 사용자 0 에게만 설치하는데(EXPO_ADB_USER), Android Automotive(Pleos Connect)는 운전자가
 * 다른 사용자(에뮬레이터는 10)라 그대로 두면 설치는 돼도 앱이 열리지 않는다. 기기의 현재 사용자에게 설치한다.
 */
export function expoRunAndroid(serial, variant) {
  const user = currentUserOf(serial);
  console.log(`\n설치 대상 Android 사용자: ${user}`);
  run("npx", ["expo", "run:android", "--device", serial, "--variant", variant], {
    cwd: projectRoot,
    env: { ...childEnv, EXPO_ADB_USER: user },
  });
}

/**
 * 빌드 종류(MOBI_APP_VARIANT: contest | market)를 정하고 android/ 를 app.config.ts 와 맞춘다.
 * `expo run:android` 는 android/ 가 없을 때만 prebuild 하므로, 실행 스크립트도 빌드 전에 반드시 부른다.
 * 건너뛰면 이전 빌드 종류의 매니페스트가 남는다 (예: market 으로 만든 뒤 시트 제어 권한이 빠진 채 설치됨).
 * 이후 명령(Gradle, 앱 설정 포함)도 같은 빌드 종류를 쓰도록 childEnv 에 넣는다.
 */
export function prebuildAndroid({ market = false } = {}) {
  childEnv.MOBI_APP_VARIANT = market ? "market" : (childEnv.MOBI_APP_VARIANT ?? "contest");
  console.log(`빌드 종류: ${childEnv.MOBI_APP_VARIANT}`);
  expo(["prebuild", "--platform", "android", "--no-install"]);
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

// AVD 설정 폴더. Android Studio 기본값은 ~/.android/avd.
const avdHome =
  process.env.ANDROID_AVD_HOME ||
  path.join(process.env.ANDROID_USER_HOME || path.join(os.homedir(), ".android"), "avd");

function iniValue(file, key) {
  try {
    const line = readFileSync(file, "utf8")
      .split(/\r?\n/)
      .find((row) => row.split("=")[0].trim() === key);
    return line ? line.slice(line.indexOf("=") + 1).trim() : "";
  } catch {
    return "";
  }
}

/**
 * Pleos Connect 시스템 이미지로 만든 AVD 인지.
 * 일반 Android·Android Automotive AVD 에는 Pleos SDK 서비스가 없어 차량 기능이 동작하지 않으므로 구분한다.
 * AVD 이름은 사람이 바꿀 수 있어 AVD 가 가리키는 시스템 이미지 경로로 판단하고, 설정을 못 읽을 때만 이름을 본다.
 */
export function isPleosAvd(name) {
  const avdDir = iniValue(path.join(avdHome, `${name}.ini`), "path");
  const image = avdDir ? iniValue(path.join(avdDir, "config.ini"), "image.sysdir.1") : "";
  return /pleos/i.test(image || name);
}

export const listPleosAvds = () => listAvds().filter(isPleosAvd);

/** 설치된 Pleos Connect 시스템 이미지 (예: android-34/pleos_car_emulator) */
export function listPleosSystemImages() {
  const root = path.join(sdkRoot, "system-images");
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((api) => api.isDirectory())
    .flatMap((api) =>
      readdirSync(path.join(root, api.name))
        .filter((tag) => /pleos/i.test(tag))
        .map((tag) => `${api.name}/${tag}`),
    );
}

/**
 * Pleos Connect 에뮬레이터가 준비되지 않았을 때의 설치 안내. 준비됐으면 null.
 * 시스템 이미지부터 없는지, AVD 만 안 만들었는지에 따라 남은 단계만 알려 준다.
 */
export function pleosInstallGuide() {
  if (listPleosAvds().length > 0) return null;
  if (listPleosSystemImages().length > 0) {
    return [
      "Pleos Connect 시스템 이미지는 설치돼 있는데, 에뮬레이터(AVD)를 아직 만들지 않았어요.",
      "  Android Studio > Device Manager > + > Automotive > Pleos Connect v2.1.0 (API 34, RAM 4GB, Default boot: Cold)",
      "  자세한 순서: ANDROID_SETUP.md 5장 3~4번. 만든 뒤 `npm run android:doctor` 로 확인해 주세요.",
    ].join("\n");
  }
  return [
    "Pleos Connect 에뮬레이터가 설치돼 있지 않아요. (일반 Android 에뮬레이터로는 대신할 수 없어요)",
    "  1) Android Studio > Settings > Android SDK > SDK Update Sites 에 Pleos 시스템 이미지 사이트 추가",
    "  2) SDK Platforms > Show Package Details > API 34 아래 Pleos Connect 시스템 이미지 설치",
    "  3) Device Manager > + > Automotive > Pleos Connect v2.1.0 (API 34, RAM 4GB, Default boot: Cold)",
    "  자세한 순서·사이트 주소: ANDROID_SETUP.md 5장. 설치한 뒤 `npm run android:doctor` 로 확인해 주세요.",
  ].join("\n");
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
