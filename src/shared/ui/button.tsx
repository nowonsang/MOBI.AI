import { ActivityIndicator, Pressable } from "react-native";

import { AppText } from "./app-text";
import { radius, sizes, spacing } from "./theme";
import { themedStyles, useColors } from "./use-theme";

type ButtonProps = {
  label: string;
  onPress: () => void;
  /** 주 CTA 는 화면당 1개 */
  variant?: "primary" | "secondary";
  disabled?: boolean;
  /** 처리 중에는 눌리지 않게 막고 진행 표시를 보여 준다 */
  loading?: boolean;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  accessibilityHint,
}: ButtonProps) {
  const inactive = disabled || loading;
  const primary = variant === "primary";
  const styles = useStyles();
  const colors = useColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        pressed && (primary ? styles.primaryPressed : styles.secondaryPressed),
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.onPrimary : colors.primary} />
      ) : (
        <AppText variant="bodyStrong" tone={primary ? "inverse" : "default"}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const useStyles = themedStyles((colors) => ({
  base: {
    minHeight: sizes.primaryButton,
    minWidth: 240,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  // Pleos 인터랙션 가이드: 눌린 요소는 95% 로 줄이고 배경색을 바꾼다.
  pressed: { transform: [{ scale: 0.95 }] },
  primary: { backgroundColor: colors.primary },
  primaryPressed: { backgroundColor: colors.primaryStrong },
  // 테두리 없이 파랑 면으로 채운다. 흰 면 + 테두리는 옅은 회색 바탕(하단 버튼 줄) 위에서 낡아 보였고,
  // 회색 면(fill)·primaryTint 는 바탕과 거의 같아 버튼으로 보이지 않았다. 글자는 ink (primary 글자는 대비가 모자란다).
  secondary: { backgroundColor: colors.secondaryButton },
  secondaryPressed: { backgroundColor: colors.primaryTint },
  inactive: { opacity: 0.4 },
}));
