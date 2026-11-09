import { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { AppText } from "./app-text";
import { colors, radius, sizes, spacing, typography } from "./theme";

type TextFieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  /** 무엇이 문제이고 어떻게 고치면 되는지 함께 쓴다 */
  error?: string;
  /** 단위·형식 안내 (예: "cm") */
  hint?: string;
};

// 라벨은 입력칸 위에 둔다. placeholder 로 라벨을 대신하지 않는다.
export function TextField({ label, error, hint, ...props }: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <View style={styles.labels}>
        <AppText variant="secondary" tone="secondary">
          {label}
        </AppText>
        {/* 단위·형식 안내는 라벨 바로 밑에 둔다. 입력칸 아래에 두면 다음 칸의 라벨처럼 읽힌다. */}
        {hint ? (
          <AppText variant="caption" tone="tertiary">
            {hint}
          </AppText>
        ) : null}
      </View>
      <TextInput
        {...props}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.inkDisabled}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        style={[
          styles.input,
          focused && styles.focused,
          error ? styles.invalid : null,
        ]}
      />
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  labels: {},
  input: {
    ...typography.body,
    minHeight: sizes.input,
    paddingHorizontal: spacing.md,
    borderWidth: 2,
    // 입력칸 경계는 정보다. 구분선용 line(대비 1.3:1) 대신 4.5:1 이상인 색을 쓴다.
    borderColor: colors.inkTertiary,
    borderRadius: radius.control,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: colors.danger },
});
