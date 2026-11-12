import { Text, type TextProps } from "react-native";

import {
  typography,
  type ColorToken,
  type TypographyVariant,
} from "./theme";
import { useColors } from "./use-theme";

type Tone =
  | "default"
  | "secondary"
  | "tertiary"
  | "danger"
  | "inverse"
  | "accent";

const toneToken: Record<Tone, ColorToken> = {
  default: "ink",
  secondary: "inkSecondary",
  tertiary: "inkTertiary",
  danger: "danger",
  // primary·success·warning 면 위 글자. 야간에는 그 면이 밝아져 어두운 글자가 된다.
  inverse: "onPrimary",
  // 흰 카드 위 강조 글자 (예: "+ 운전자 추가하기" 행). 화면당 한두 곳에만.
  accent: "primary",
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
