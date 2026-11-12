import { View } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import type { SeatAxisGroupId } from "../model/bodyfit-axis-group";
import { AXIS_GROUP_LABEL } from "./bodyfit-axis-copy";

type BodyfitAxisGroupHeadingProps = {
  group: SeatAxisGroupId;
  /** 묶음 이름 옆 한마디 (예: "5곳", "3/5 맞춤") */
  note: string;
  /** 첫 묶음이 아니면 위에 구분선을 긋는다 */
  divided: boolean;
};

// 카드 안에서 축을 "자세 / 머리·벨트" 로 나누는 작은 제목. 묶음이 둘 다 있을 때만 쓴다.
export function BodyfitAxisGroupHeading({
  group,
  note,
  divided,
}: BodyfitAxisGroupHeadingProps) {
  const styles = useStyles();
  return (
    <View style={[styles.heading, divided && styles.divided]}>
      <AppText
        variant="secondary"
        tone="secondary"
        accessibilityRole="header"
        style={styles.label}
      >
        {AXIS_GROUP_LABEL[group]}
      </AppText>
      <AppText variant="caption" tone="tertiary">
        {note}
      </AppText>
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  heading: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  divided: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  label: { fontWeight: "700" },
}));
