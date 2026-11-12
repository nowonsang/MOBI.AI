import Constants from "expo-constants";

// 빌드 종류 (app.config.ts 의 MOBI_APP_VARIANT). market 빌드는 Pleos 승인 전 권한을 매니페스트에서 빼므로
// 그 권한이 필요한 기능은 화면에서도 숨긴다.
const variant: unknown = Constants.expoConfig?.extra?.appVariant;

/** 시트 자동 조절 (CONTROL_CAR_SEATS, Pleos "준비 중") */
export const canControlSeat = variant !== "market";

/** 음성 인식·음성 안내 (STT_SERVICE·TTS_SERVICE, Pleos "준비 중") */
export const canUseVoice = variant !== "market";

/** 시연용 빌드 (contest: 영상·GitHub APK·2차 PT). 실사용 기준을 그대로 쓰면 시연할 수 없는 값만 줄인다. */
export const isDemoBuild = variant !== "market";

/** 열선·공조 맞추기 (CONTROL_CAR_CLIMATE·CONTROL_CAR_SEATS, Pleos "준비 중"). 읽기·기록은 어느 빌드에서나 한다. */
export const canControlComfort = variant !== "market";

/** 가이드 조절 시연 모드 (모의 시트 위치). 공모전 시연용이라 앱 마켓 빌드에는 넣지 않는다. */
export const canUseDemoMode = variant !== "market";
