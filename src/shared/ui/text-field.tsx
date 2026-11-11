import { useState, type ComponentRef, type Ref } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { AppText } from "./app-text";
import { colors, radius, sizes, spacing, typography } from "./theme";

/** 키보드의 "다음" 키로 포커스를 옮길 때 쓰는 입력칸 ref 타입 */
export type TextFieldHandle = ComponentRef<typeof TextInput>;

type TextFieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  /** 무엇이 문제이고 어떻게 고치면 되는지 함께 쓴다 */
  error?: string;
  /** 단위·형식 안내 (예: "cm") */
  hint?: string;
  /** 키보드의 "다음" 키로 이 칸에 포커스를 옮길 때 쓴다 */
  ref?: Ref<TextFieldHandle>;
};

// 라벨은 입력칸 위에 둔다. placeholder 로 라벨을 대신하지 않는다.
export function TextField({
  label,
  error,
  hint,
  ref,
  ...props
}: TextFieldProps) {
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
        // 차량 가로 화면에서 Android 가 전체 화면 입력으로 바꾸면 폼 전체가 가려져 다음 칸을 누를 수 없다.
        disableFullscreenUI
        {...props}
        ref={ref}
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
    borderColor: colors.lineStrong,
    borderRadius: radius.control,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: colors.danger },
});
