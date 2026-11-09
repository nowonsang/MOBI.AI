import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "./app-text";
import { colors, layout, sizes, spacing } from "./theme";
import { useCompact } from "./use-compact";

type ScreenProps = {
  title: string;
  description?: string;
  /** 한 가지 작업만 하는 화면(입력·확인)은 narrow */
  width?: "narrow" | "content";
  /** 화면 하단에 고정할 행동. 보조 버튼을 먼저, 주 CTA 를 마지막에 둔다 (좁은 창에서는 주 CTA 가 맨 아래). */
  footer?: ReactNode;
  /**
   * 뒤로 가기 버튼. 첫 화면은 false 로 둔다: 시작할 때 거치는 Redirect(/) 가 스택에 남아
   * canGoBack 이 true 여도 돌아갈 화면이 없다.
   */
  back?: boolean;
  children: ReactNode;
};

// 화면 틀은 이 컴포넌트 하나가 맡는다: 안전 영역, 뒤로 가기, 제목, 본문 폭, 하단 고정 버튼.
// 네이티브 헤더는 쓰지 않는다. 헤더와 이 화면이 안전 영역 여백을 두 번 넣어 제목 위가 비었기 때문이다.
export function Screen({
  title,
  description,
  width = "content",
  footer,
  back = true,
  children,
}: ScreenProps) {
  const router = useRouter();
  const compact = useCompact();
  const maxWidth = width === "narrow" ? layout.narrow : layout.content;
  const gutter = compact ? layout.gutterCompact : layout.gutter;

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "bottom", "left", "right"]}
    >
      {back && router.canGoBack() ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          onPress={() => router.back()}
          hitSlop={spacing.xs}
          style={({ pressed }) => [
            styles.back,
            { marginLeft: gutter - spacing.sm },
            pressed && styles.backPressed,
          ]}
        >
          <AppText variant="title" style={styles.backIcon}>
            ←
          </AppText>
        </Pressable>
      ) : null}
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: gutter,
            paddingVertical: compact ? spacing.lg : spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.body,
            { maxWidth, gap: compact ? spacing.lg : spacing.xl },
          ]}
        >
          <View style={styles.header}>
            <AppText variant="title" accessibilityRole="header">
              {title}
            </AppText>
            {description ? (
              <AppText variant="secondary" tone="secondary">
                {description}
              </AppText>
            ) : null}
          </View>
          {children}
        </View>
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, { paddingHorizontal: gutter }]}>
          <View
            style={[
              styles.footerInner,
              { maxWidth },
              compact ? styles.footerStacked : styles.footerRow,
            ]}
          >
            {footer}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  back: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  backPressed: { opacity: 0.5, transform: [{ scale: 0.95 }] },
  backIcon: { color: colors.primary },
  scroll: { alignItems: "center" },
  body: { width: "100%" },
  header: { gap: spacing.xs },
  footer: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    alignItems: "center",
  },
  // 터치 대상 사이는 최소 24dp (spacing.md).
  footerInner: { width: "100%", gap: spacing.md },
  // 넓은 창: 오른쪽에 나란히. 좁은 창: 화면 폭에 맞춰 세로로 쌓아 주 CTA 를 맨 아래(엄지 닿는 곳)에 둔다.
  footerRow: { flexDirection: "row", justifyContent: "flex-end" },
  footerStacked: { flexDirection: "column", alignItems: "stretch" },
});
