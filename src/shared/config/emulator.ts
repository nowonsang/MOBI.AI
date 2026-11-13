import { Platform } from "react-native";

// Android 에뮬레이터인지 (Pleos Connect 에뮬레이터: 모델 "Car on arm64 emulator", 빌드 정보에 "avd").
// 에뮬레이터에서만 쓰는 시연용 대체 데이터를 고르는 데만 쓴다. 실제 차량에서는 항상 false.
function detectEmulator(): boolean {
  if (Platform.OS !== "android") return false;
  const constants = Platform.constants as {
    Model?: string;
    Fingerprint?: string;
  };
  return /emulator|\bavd\b|_avd_|generic/i.test(
    `${constants.Model ?? ""} ${constants.Fingerprint ?? ""}`,
  );
}

export const isEmulator = detectEmulator();
