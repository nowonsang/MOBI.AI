import { View } from "react-native";

import { isEmulator } from "@/shared/config/emulator";
import { AppText } from "@/shared/ui/app-text";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import {
  POSTURE_EMULATOR_NOTICE,
  POSTURE_SAMPLE_NOTICE,
} from "./bodyfit-posture-copy";

/** 화면의 숫자가 실제 주행이 아니라 예시 기록임을 알리는 표시. 예시 기록을 보여 주는 화면마다 맨 위에 둔다 */
export function BodyfitPostureSampleNotice() {
  const styles = useStyles();
  return (
    <View style={styles.tag}>
      <AppText variant="caption">
        {isEmulator ? POSTURE_EMULATOR_NOTICE : POSTURE_SAMPLE_NOTICE}
      </AppText>
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  // 옅은 파랑 면 + ink 글자 (theme.test 의 검사 조합)
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.control,
    backgroundColor: colors.primaryTint,
  },
}));
