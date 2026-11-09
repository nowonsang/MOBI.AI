import { Text, type TextProps } from "react-native";

import { colors, typography, type TypographyVariant } from "./theme";

type Tone = "default" | "secondary" | "tertiary" | "danger" | "inverse";

const toneColor: Record<Tone, string> = {
  default: colors.ink,
  secondary: colors.inkSecondary,
  tertiary: colors.inkTertiary,
  danger: colors.danger,
  inverse: colors.surface,
};

type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  tone?: Tone;
};

export function AppText({
  variant = "body",
  tone = "default",
  style,
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[typography[variant], { color: toneColor[tone] }, style]}
    />
  );
}
