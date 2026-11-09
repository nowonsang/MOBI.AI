import Constants from "expo-constants";

// 빌드 종류 (app.config.ts 의 MOBI_APP_VARIANT). market 빌드는 Pleos 승인 전 권한을 매니페스트에서 빼므로
// 그 권한이 필요한 기능은 화면에서도 숨긴다.
const variant: unknown = Constants.expoConfig?.extra?.appVariant;

/** 시트 자동 조절 (CONTROL_CAR_SEATS, Pleos "준비 중") */
export const canControlSeat = variant !== "market";

/** 음성 인식·음성 안내 (STT_SERVICE·TTS_SERVICE, Pleos "준비 중") */
export const canUseVoice = variant !== "market";
