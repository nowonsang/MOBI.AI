import { StyleSheet, View } from "react-native";

import { AppText } from "./app-text";
import { colors, radius, sizes } from "./theme";

type Tone = "default" | "tint" | "muted" | "primary" | "success" | "warning";

type IconBadgeProps = {
  /** 한두 글자 기호나 이니셜 (예: "↔", "P", "A"). 아이콘 글꼴 없이 시스템 글꼴로 그린다 */
  glyph: string;
  /** default: 흰 원 + 옅은 테두리, tint: 옅은 파랑(아바타), muted: 아직 차례가 아닌 단계 */
  tone?: Tone;
};

const toneStyle: Record<Tone, { backgroundColor: string; color: string }> = {
  default: { backgroundColor: colors.surface, color: colors.inkSecondary },
  tint: { backgroundColor: colors.primaryTint, color: colors.primary },
  muted: { backgroundColor: colors.fill, color: colors.inkTertiary },
  primary: { backgroundColor: colors.primary, color: colors.surface },
  success: { backgroundColor: colors.success, color: colors.surface },
  warning: { backgroundColor: colors.warning, color: colors.surface },
};

// 행 앞에 두는 원형 아이콘. 뜻은 항상 옆 글자가 전하므로 스크린리더에서는 건너뛴다.
export function IconBadge({ glyph, tone = "default" }: IconBadgeProps) {
  const { backgroundColor, color } = toneStyle[tone];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor },
        tone === "default" && styles.outlined,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <AppText variant="bodyStrong" style={{ color }}>
        {glyph}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: sizes.iconBadge,
    height: sizes.iconBadge,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  outlined: { borderWidth: 1, borderColor: colors.line },
});
