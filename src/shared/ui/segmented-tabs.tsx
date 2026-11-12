import { Pressable, View } from "react-native";

import { AppText } from "./app-text";
import { radius, shadows, sizes, spacing } from "./theme";
import { themedStyles } from "./use-theme";

type TabOption<T extends string> = {
  value: T;
  label: string;
  /** 라벨 옆 짧은 숫자·상태 (예: "3곳", "6건") */
  note?: string;
};

type SegmentedTabsProps<T extends string> = {
  /** 스크린리더가 읽는 탭 묶음 이름 (예: "시트 화면 보기") */
  label: string;
  /** 차량 화면에서는 세 개 이하로 쓴다 (탭 하나가 한눈에 읽히는 폭) */
  options: readonly TabOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
};

// 한 화면의 내용을 몇 갈래로 나눠 한 번에 하나만 보여 주는 탭. 긴 스크롤 대신 쓴다.
// 고른 탭은 색만으로 알리지 않는다: 굵은 글자 + 밑줄을 함께 쓴다.
// 고른 탭에 옅은 파란 면을 깔지 않는다 (파란 글자 대비가 4.5:1 아래로 떨어진다).
export function SegmentedTabs<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: SegmentedTabsProps<T>) {
  const styles = useStyles();
  return (
    <View
      style={styles.bar}
      accessibilityRole="tablist"
      accessibilityLabel={label}
    >
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={
              option.note ? `${option.label}, ${option.note}` : option.label
            }
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View style={styles.label}>
              <AppText
                variant={active ? "bodyStrong" : "body"}
                tone={active ? "accent" : "secondary"}
                numberOfLines={1}
              >
                {option.label}
              </AppText>
              {option.note ? (
                <View style={styles.note}>
                  <AppText variant="caption" tone="tertiary">
                    {option.note}
                  </AppText>
                </View>
              ) : null}
            </View>
            <View
              style={[styles.underline, active && styles.underlineActive]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const UNDERLINE = 4;

const useStyles = themedStyles((colors) => ({
  // 카드와 같은 흰 면에 올려 본문 카드와 한 묶음으로 보이게 한다.
  bar: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  tab: {
    flex: 1,
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs / 2,
  },
  // Pleos 인터랙션 가이드: 눌린 요소는 95% 로 줄이고 배경색을 바꾼다.
  pressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.95 }],
  },
  label: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    columnGap: spacing.xs,
  },
  note: {
    paddingHorizontal: spacing.xs + spacing.xs / 2,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  // 고르지 않은 탭도 같은 높이를 차지해 탭을 바꿀 때 글자가 위아래로 움직이지 않는다.
  underline: {
    width: spacing.xxl,
    height: UNDERLINE,
    borderRadius: radius.pill,
  },
  underlineActive: { backgroundColor: colors.primary },
}));
