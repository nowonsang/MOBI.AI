import { View } from "react-native";

import { AppText } from "./app-text";
import { radius, sizes, type ColorToken } from "./theme";
import { themedStyles, useColors } from "./use-theme";

type Tone = "default" | "tint" | "muted" | "primary" | "success" | "warning";

type IconBadgeProps = {
  /** 한두 글자 기호나 이니셜 (예: "↔", "P", "A"). 아이콘 글꼴 없이 시스템 글꼴로 그린다 */
  glyph: string;
  /** default: 흰 원 + 옅은 테두리, tint: 옅은 파랑(아바타), muted: 아직 차례가 아닌 단계 */
  tone?: Tone;
};

// [원 바탕, 기호]
const toneTokens: Record<Tone, [ColorToken, ColorToken]> = {
  default: ["surface", "inkSecondary"],
  tint: ["primaryTint", "primary"],
  muted: ["fill", "inkTertiary"],
  primary: ["primary", "onPrimary"],
  success: ["success", "onPrimary"],
  warning: ["warning", "onPrimary"],
};

// 행 앞에 두는 원형 아이콘. 뜻은 항상 옆 글자가 전하므로 스크린리더에서는 건너뛴다.
export function IconBadge({ glyph, tone = "default" }: IconBadgeProps) {
  const styles = useStyles();
  const colors = useColors();
  const [background, glyphColor] = toneTokens[tone];
  const backgroundColor = colors[background];
  const color = colors[glyphColor];
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

const useStyles = themedStyles((colors) => ({
  badge: {
    width: sizes.iconBadge,
    height: sizes.iconBadge,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  outlined: { borderWidth: 1, borderColor: colors.line },
}));
