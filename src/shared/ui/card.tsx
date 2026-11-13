import type { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "./app-text";
import { radius, shadows, sizes, spacing } from "./theme";
import { useInPanel } from "./panel";
import { useCompact } from "./use-compact";
import { themedStyles } from "./use-theme";

type CardProps = {
  /** 카드 제목 (섹션 제목). 없으면 내용만 담는다 */
  title?: string;
  /** 제목 옆 작은 개수 표시 (예: "3명") */
  count?: string;
  /** 누르면 다른 화면으로 가는 카드. 제목 오른쪽에 › 를 그린다 */
  onPress?: () => void;
  /** 제목 오른쪽 끝에 둘 작은 글자 버튼 (예: "편집"). onPress 가 있는 카드에는 쓰지 않는다 */
  action?: ReactNode;
  accessibilityLabel?: string;
  /** 남는 높이를 채운다 (단마다 스크롤하는 Columns 에서 카드 바닥을 단 바닥에 맞출 때) */
  fill?: boolean;
  children?: ReactNode;
};

// 같은 목적의 정보를 한 덩어리로 묶는 흰 카드. 옅은 바탕(Screen) 위에 연한 그림자로 띄운다.
export function Card({
  title,
  count,
  onPress,
  action,
  accessibilityLabel,
  fill,
  children,
}: CardProps) {
  const compact = useCompact();
  const styles = useStyles();
  const inPanel = useInPanel();

  const heading = title ? (
    <View style={[styles.heading, inPanel && styles.headingInPanel]}>
      <View style={styles.titleGroup}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {count ? (
          <View style={styles.count}>
            <AppText variant="caption" tone="tertiary">
              {count}
            </AppText>
          </View>
        ) : null}
      </View>
      {onPress ? (
        <AppText variant="title" tone="tertiary">
          ›
        </AppText>
      ) : (
        action
      )}
    </View>
  ) : null;

  const boxStyle = inPanel
    ? [styles.section, fill && styles.fill]
    : [
        styles.box,
        { padding: compact ? spacing.md : spacing.lg },
        fill && styles.fill,
      ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        onPress={onPress}
        style={({ pressed }) => [...boxStyle, pressed && styles.pressed]}
      >
        {heading}
        {children}
      </Pressable>
    );
  }

  return (
    <View style={boxStyle}>
      {heading}
      {children}
    </View>
  );
}

type SummaryCardProps = {
  /** 무엇에 대한 요약인지 (예: "추천 자세") */
  label: string;
  /** 한눈에 읽을 값 (예: "4곳 중 3곳 조절") */
  value: string;
  onPress?: () => void;
  accessibilityHint?: string;
  /** 값이 한 문장일 때: 라벨을 작게 위에 두고 값을 그 아래에 크게 쓴다 (기본은 라벨과 값을 한 줄에) */
  stacked?: boolean;
};

// 화면에서 가장 중요한 한 줄을 파란 면으로 강조한다 (화면당 1개).
export function SummaryCard({
  label,
  value,
  onPress,
  accessibilityHint,
  stacked,
}: SummaryCardProps) {
  const styles = useStyles();
  const content = (
    <>
      <AppText variant={stacked ? "secondary" : "bodyStrong"} tone="inverse">
        {label}
      </AppText>
      <View
        style={[styles.summaryValue, stacked && styles.summaryValueStacked]}
      >
        <AppText
          variant={stacked ? "heading" : "bodyStrong"}
          tone="inverse"
          style={stacked ? styles.summaryText : undefined}
        >
          {value}
        </AppText>
        {onPress ? (
          <AppText variant="title" tone="inverse">
            ›
          </AppText>
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}`}
        accessibilityHint={accessibilityHint}
        onPress={onPress}
        style={({ pressed }) => [
          styles.summary,
          stacked && styles.summaryStacked,
          pressed && styles.summaryPressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.summary, stacked && styles.summaryStacked]}
      accessible
      accessibilityLabel={`${label}, ${value}`}
    >
      {content}
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  box: {
    gap: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  fill: { flexGrow: 1 },
  // 패널 안: 상자 없이 구역으로. 구역 사이는 아래 옅은 선으로 나눈다 (패널이 좌우 여백을 준다).
  section: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headingInPanel: { paddingBottom: 0, borderBottomWidth: 0 },
  // Pleos 인터랙션 가이드: 눌린 요소는 줄이고 배경색을 바꾼다. 큰 면은 95% 면 너무 출렁여 98% 로 둔다.
  pressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.98 }],
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
    flexShrink: 1,
  },
  count: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  summary: {
    minHeight: sizes.primaryButton + spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.primary,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  summaryPressed: {
    backgroundColor: colors.primaryStrong,
    transform: [{ scale: 0.98 }],
  },
  summaryValue: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  summaryStacked: {
    flexDirection: "column",
    flexWrap: "nowrap",
    alignItems: "stretch",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  summaryValueStacked: { justifyContent: "space-between" },
  // 긴 문장이 카드 안에서 줄바꿈되게 한다 (› 옆에서도).
  summaryText: { flexShrink: 1 },
}));
