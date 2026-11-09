// Pleos 필수 매니페스트 항목과 Pleos Playground SDK 클라이언트 ID·시크릿(서버 모드 STT·TTS 용)을 AndroidManifest <meta-data> 로 넣는다.
// app.config 옵션으로 받지 않고 여기서 직접 읽는다: 앱 설정은 expo-constants 로 JS 에 그대로 노출되기 때문이다.
// 값은 prebuild 가 만드는 android/(gitignore) 에만 기록된다. 단, 빌드된 APK 에서는 추출할 수 있으므로 유출 시 재발급한다.
const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

/** @type {import("expo/config-plugins").ConfigPlugin} */
const withPleosConnect = (config) =>
  withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(
      mod.modResults,
    );
    // Pleos CCP(회전 다이얼) 가이드: CCP 를 지원하지 않는 앱은 반드시 false 로 선언하고 터치만으로 모두 동작해야 한다.
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      "com.hmg.rotary.ROTARY_SUPPORTED",
      "false",
    );
    const metaData = {
      "ai.mobi.pleos.CLIENT_ID": process.env.PLEOS_CLIENT_ID,
      "ai.mobi.pleos.CLIENT_SECRET": process.env.PLEOS_CLIENT_SECRET,
    };
    for (const [name, value] of Object.entries(metaData)) {
      if (value) {
        AndroidConfig.Manifest.addMetaDataItemToMainApplication(
          app,
          name,
          value,
        );
      } else {
        AndroidConfig.Manifest.removeMetaDataItemFromMainApplication(app, name);
      }
    }
    return mod;
  });

module.exports = withPleosConnect;
