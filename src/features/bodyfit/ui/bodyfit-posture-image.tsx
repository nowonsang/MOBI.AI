import { Image, StyleSheet, View } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

// 운전자 옆모습 그림 (Higgsfield 로 만든 선 그림, 투명 배경). 실제 사람 사진이 아니다.
// upright: 출발 자세(머리·어깨·등에 점), drift: 출발 자세(점선) 위에 앞으로 쏠린 자세(파란 선).
// 그림은 어떤 변화인지 보여 주는 고정 그림이고, 실제 변화량은 항상 옆의 숫자·글자가 전한다.
const IMAGES = {
  upright: require("@/assets/images/posture-upright.png"),
  drift: require("@/assets/images/posture-drift.png"),
};

type Props = {
  pose: keyof typeof IMAGES;
  height?: number;
  /** 스크린리더가 읽을 설명 */
  label: string;
};

export function BodyfitPostureImage({ pose, height = 280, label }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.stage}>
      <Image
        source={IMAGES[pose]}
        resizeMode="contain"
        style={[imageStyles.image, { height }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
      />
    </View>
  );
}

/** drift 그림의 범례: 점선 = 출발 때, 파란 선 = 도착 때 */
export function BodyfitPostureImageLegend() {
  const styles = useStyles();
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={styles.dashes}>
          <View style={styles.dash} />
          <View style={styles.dash} />
          <View style={styles.dash} />
        </View>
        <AppText variant="caption" tone="secondary">
          출발 때
        </AppText>
      </View>
      <View style={styles.legendItem}>
        <View style={styles.solid} />
        <AppText variant="caption" tone="secondary">
          도착 때
        </AppText>
      </View>
    </View>
  );
}

const imageStyles = StyleSheet.create({
  image: { width: "100%" },
});

const useStyles = themedStyles((colors) => ({
  // 2단 높이 맞추기로 카드가 길어지면 늘어난 만큼을 그림 칸이 차지한다 (카드 아래에 빈 곳이 남지 않게).
  stage: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: spacing.lg,
    rowGap: spacing.xs,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  dashes: { flexDirection: "row", gap: 6 },
  dash: {
    width: 10,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.inkDisabled,
  },
  solid: {
    width: 44,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
}));
