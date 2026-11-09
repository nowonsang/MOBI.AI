import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { AppText } from "./app-text";
import { colors, radius, sizes, spacing } from "./theme";

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
        <ActivityIndicator color={primary ? colors.surface : colors.primary} />
      ) : (
        <AppText variant="bodyStrong" tone={primary ? "inverse" : "default"}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    // 버튼 경계는 정보다. 구분선용 line(대비 1.3:1) 대신 4.5:1 이상인 색을 쓴다.
    borderColor: colors.inkTertiary,
  },
  secondaryPressed: { backgroundColor: colors.sandLight },
  inactive: { opacity: 0.4 },
});
