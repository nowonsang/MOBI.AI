import { Pressable, View } from "react-native";

import { AppText } from "./app-text";
import { radius, sizes, spacing } from "./theme";
import { themedStyles } from "./use-theme";

type ChipOption<T extends string> = { value: T; label: string };

type ChipGroupProps<T extends string> = {
  /** 스크린리더가 읽는 묶음 이름 (예: "운전자 고르기") */
  label: string;
  options: readonly ChipOption<T>[];
  selected: T | null;
  onSelect: (value: T) => void;
  /** grid: 두 개씩 같은 폭으로 줄을 채운다 (좁은 카드에서 칩이 한쪽으로 쏠리지 않게) */
  layout?: "wrap" | "grid";
};

// 여러 대상 중 하나를 고르는 칩 (마이현대 앱의 차량 선택 칩처럼). 고른 칩은 색과 ✓ 로 함께 표시한다.
export function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
  layout = "wrap",
}: ChipGroupProps<T>) {
  const styles = useStyles();
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
              layout === "grid" && styles.gridChip,
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
  const styles = useStyles();
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

const useStyles = themedStyles((colors) => ({
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
  // 간격(gap)을 빼고 두 개가 한 줄을 나눠 갖는다
  gridChip: { flexGrow: 1, flexBasis: "40%" },
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
}));
