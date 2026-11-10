import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "./app-text";
import { colors, sizes, spacing } from "./theme";

type InfoRowProps = {
  /** 행 앞 아이콘 (보통 IconBadge) */
  icon?: ReactNode;
  /** 무엇에 대한 값인지 (예: "앞뒤 위치"). 값이 스스로 설명되면(이름 등) 생략한다 */
  label?: string;
  /** 한눈에 읽을 값 (예: "지금 45% → 추천 52%") */
  value: string;
  /** 값 아래 한 줄 보조 설명 */
  detail?: string;
  /** 오른쪽 끝 (상태 칩 등). onPress 가 있으면 › 를 그린다 */
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
};

// 아이콘 · 라벨 · 값 한 줄 (마이현대 앱의 "내 차 시세" 행처럼). 카드 안 목록에 쓴다.
export function InfoRow({
  icon,
  label,
  value,
  detail,
  trailing,
  onPress,
  accessibilityLabel,
}: InfoRowProps) {
  const content = (
    <>
      {icon}
      <View style={styles.text}>
        {label ? (
          <AppText variant="caption" tone="tertiary">
            {label}
          </AppText>
        ) : null}
        <AppText variant="bodyStrong">{value}</AppText>
        {detail ? (
          <AppText variant="caption" tone="tertiary">
            {detail}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {onPress ? (
        <AppText variant="title" tone="tertiary">
          ›
        </AppText>
      ) : null}
    </>
  );

  const label11y =
    accessibilityLabel ?? [label, value, detail].filter(Boolean).join(", ");

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label11y}
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View style={styles.row} accessible accessibilityLabel={label11y}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: sizes.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: { flex: 1, gap: 2 },
  // Pleos 인터랙션 가이드: 눌린 요소는 95% 로 줄이고 배경색을 바꾼다.
  pressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.98 }],
  },
});
