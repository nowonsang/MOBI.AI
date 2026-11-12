import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "./app-text";
import { layout, radius, sizes, spacing } from "./theme";
import { useCompact } from "./use-compact";
import { themedStyles } from "./use-theme";

type ScreenProps = {
  title: string;
  description?: string;
  /** 한 가지 작업만 하는 화면(입력·확인)은 narrow */
  width?: "narrow" | "content";
  /** 화면 하단에 고정할 행동. 보조 버튼을 먼저, 주 CTA 를 마지막에 둔다 (좁은 창에서는 주 CTA 가 맨 아래). */
  footer?: ReactNode;
  /**
   * 뒤로 가기 버튼. 첫 화면만 false 로 둔다. 돌아갈 화면이 스택에 없으면 첫 화면(/)으로 보낸다.
   * 렌더 중의 canGoBack() 은 화면 전환 직후 예전 값을 줄 수 있어 버튼을 보일지 판단하는 데 쓰지 않는다
   * (운전자 목록 → 맞춤 자세에서 버튼이 사라졌다).
   */
  back?: boolean;
  /** 제목 오른쪽에 두는 짧은 상태 표시 (예: 기어 상태). 좁은 창에서는 제목 아래로 내려간다 */
  aside?: ReactNode;
  children: ReactNode;
};

// 화면 틀은 이 컴포넌트 하나가 맡는다: 안전 영역, 옅은 바탕, 뒤로 가기, 제목, 본문 폭, 하단 고정 버튼.
// 네이티브 헤더는 쓰지 않는다. 헤더와 이 화면이 안전 영역 여백을 두 번 넣어 제목 위가 비었기 때문이다.
export function Screen({
  title,
  description,
  width = "content",
  footer,
  back = true,
  aside,
  children,
}: ScreenProps) {
  const router = useRouter();
  const compact = useCompact();
  const styles = useStyles();
  const maxWidth = width === "narrow" ? layout.narrow : layout.content;
  const gutter = compact ? layout.gutterCompact : layout.gutter;
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "bottom", "left", "right"]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingHorizontal: gutter,
            paddingVertical: compact ? spacing.md : spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.body,
            { maxWidth, gap: compact ? spacing.md : spacing.lg },
          ]}
        >
          <View style={styles.headerRow}>
            {back ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="뒤로 가기"
                onPress={goBack}
                style={({ pressed }) => [
                  styles.back,
                  pressed && styles.backPressed,
                ]}
              >
                <AppText variant="heading">←</AppText>
              </Pressable>
            ) : null}
            <View style={styles.header}>
              <AppText
                variant={compact ? "title" : "display"}
                accessibilityRole="header"
              >
                {title}
              </AppText>
              {description ? (
                <AppText variant="secondary" tone="tertiary">
                  {description}
                </AppText>
              ) : null}
              {aside && compact ? aside : null}
            </View>
            {aside && !compact ? aside : null}
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

const useStyles = themedStyles((colors) => ({
  safe: { flex: 1, backgroundColor: colors.surfaceMuted },
  scroll: { alignItems: "center" },
  body: { width: "100%" },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  back: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  // Pleos 인터랙션 가이드: 눌린 요소는 95% 로 줄이고 배경색을 바꾼다.
  backPressed: {
    backgroundColor: colors.fill,
    transform: [{ scale: 0.95 }],
  },
  header: { flex: 1, gap: spacing.xs },
  footer: { paddingVertical: spacing.md, alignItems: "center" },
  // 터치 대상 사이는 최소 24dp (spacing.md).
  footerInner: { width: "100%", gap: spacing.md },
  // 넓은 창: 오른쪽에 나란히. 좁은 창: 화면 폭에 맞춰 세로로 쌓아 주 CTA 를 맨 아래(엄지 닿는 곳)에 둔다.
  footerRow: { flexDirection: "row", justifyContent: "flex-end" },
  footerStacked: { flexDirection: "column", alignItems: "stretch" },
}));
