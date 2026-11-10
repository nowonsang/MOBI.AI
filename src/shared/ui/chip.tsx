import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "./app-text";
import { colors, radius, sizes, spacing } from "./theme";

type ChipOption<T extends string> = { value: T; label: string };

type ChipGroupProps<T extends string> = {
  /** 스크린리더가 읽는 묶음 이름 (예: "운전자 고르기") */
  label: string;
  options: readonly ChipOption<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
};

// 여러 대상 중 하나를 고르는 칩 (마이현대 앱의 차량 선택 칩처럼). 고른 칩은 색과 ✓ 로 함께 표시한다.
export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: ChipGroupProps<T>) {
  return (
    <View
      style={styles.group}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onSelect(option.value)}
            hitSlop={spacing.xs}
            style={({ pressed }) => [
              styles.chip,
              active ? styles.active : styles.idle,
              pressed && styles.pressed,
            ]}
          >
            <AppText
              variant={active ? "bodyStrong" : "body"}
              tone={active ? "inverse" : "secondary"}
            >
              {active ? `✓ ${option.label}` : option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

type ToggleChipProps = {
  label: string;
  checked: boolean;
  onPress: () => void;
  /** 방향을 알려 주는 한 글자 기호 (예: "↑"). 글자 앞에 붙는다 */
  glyph?: string;
  /** tile: 격자에 놓는 큰 사각 선택지 (폭을 부모가 정한다) */
  shape?: "pill" | "tile";
};

// 여러 개를 함께 고를 수 있는 칩. 고른 칩은 색과 ✓ 로 함께 표시한다.
export function ToggleChip({
  label,
  checked,
  onPress,
  glyph,
  shape = "pill",
}: ToggleChipProps) {
  const text = glyph ? `${glyph} ${label}` : label;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={shape === "pill" ? spacing.xs : undefined}
      style={({ pressed }) => [
        shape === "tile" ? styles.tile : styles.chip,
        checked ? styles.active : styles.idle,
        pressed && styles.pressed,
      ]}
    >
      <AppText
        variant={checked ? "bodyStrong" : "body"}
        tone={checked ? "inverse" : "secondary"}
      >
        {checked ? `✓ ${text}` : text}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 터치 대상 사이는 최소 24dp
  group: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  chip: {
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget * 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  tile: {
    minHeight: sizes.primaryButton + spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  active: { backgroundColor: colors.primary },
  idle: { backgroundColor: colors.fill },
  // Pleos 인터랙션 가이드: 눌린 요소는 95% 로 줄인다.
  pressed: { transform: [{ scale: 0.95 }] },
});
