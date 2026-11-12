import { Text, type TextProps } from "react-native";

import {
  typography,
  type ColorToken,
  type TypographyVariant,
} from "./theme";
import { useColors } from "./use-theme";

type Tone = "default" | "secondary" | "tertiary" | "danger" | "inverse";

const toneToken: Record<Tone, ColorToken> = {
  default: "ink",
  secondary: "inkSecondary",
  tertiary: "inkTertiary",
  danger: "danger",
  // primary·success·warning 면 위 글자. 야간에는 그 면이 밝아져 어두운 글자가 된다.
  inverse: "onPrimary",
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
  const colors = useColors();
  return (
    <Text
      {...props}
      style={[typography[variant], { color: colors[toneToken[tone]] }, style]}
    />
  );
}
