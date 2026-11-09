import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "./app-text";
import { colors, layout, spacing } from "./theme";

type ScreenProps = {
  title: string;
  description?: string;
  /** 한 가지 작업만 하는 화면(입력·확인)은 narrow */
  width?: "narrow" | "content";
  /** 화면 하단에 고정할 주 행동 (주 CTA 1개) */
  footer?: ReactNode;
  children: ReactNode;
};

export function Screen({
  title,
  description,
  width = "content",
  footer,
  children,
}: ScreenProps) {
  const maxWidth = width === "narrow" ? layout.narrow : layout.content;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.body, { maxWidth }]}>
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
        <View style={styles.footer}>
          <View style={[styles.footerInner, { maxWidth }]}>{footer}</View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: {
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  body: { width: "100%", gap: spacing.xl },
  header: { gap: spacing.xs },
  footer: {
    paddingHorizontal: layout.gutter,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    alignItems: "center",
  },
  footerInner: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
  },
});
