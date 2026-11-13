import type { ReactNode } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";

import { PanelContext } from "./panel";
import { layout, radius, shadows, spacing } from "./theme";
import { usePinnedLayout } from "./use-pinned-layout";
import { themedStyles } from "./use-theme";

type ColumnsProps = {
  /**
   * 요약·그림 (넓은 창에서 왼쪽 40%).
   * 그림 하나가 핵심인 화면은 비워 두고 오른쪽 단 하나를 폭 전체로 쓴다 (ui-design 1장).
   */
  left?: ReactNode;
  /** 목록·선택지 (넓은 창에서 오른쪽 60%) */
  right: ReactNode;
  /** 오른쪽 단 맨 위에 두는 것 (예: 탭 막대). pinned 일 때 스크롤해도 자리를 지킨다 */
  rightHeader?: ReactNode;
  /**
   * 단마다 따로 스크롤한다 (Screen 의 pinned 와 함께 쓴다).
   * 긴 목록을 내려도 왼쪽 요약과 오른쪽 탭이 화면에 남는다. 좁거나 낮은 창에서는 꺼진다.
   */
  pinned?: boolean;
  /**
   * 넓은 창에서 두 단의 높이를 맞춘다. 단 안 마지막 카드에 Card 의 fill 을 주면 남는 높이를 채워
   * 왼쪽·오른쪽 카드의 아래 끝이 나란히 맞는다. 좁은 창에서는 위아래로 쌓으므로 영향이 없다.
   */
  stretch?: boolean;
  /**
   * 오른쪽 단을 카드 한 장(패널)으로 그린다. rightHeader(탭)가 패널 머리에 붙고,
   * 안의 Card 는 상자 대신 구역이 된다 (카드 안 카드로 네모가 겹치지 않게).
   */
  rightPanel?: boolean;
};

// 가로로 넓은 차량 화면을 2단으로 나눈다. 좁은 창(세로 분할 창, 휴대폰)에서는 위아래로 쌓는다.
export function Columns({
  left,
  right,
  rightHeader,
  pinned,
  stretch = false,
  rightPanel = false,
}: ColumnsProps) {
  const wide = useWindowDimensions().width >= layout.twoColumnWidth;
  const pin = usePinnedLayout() && pinned;
  const styles = useStyles();

  if (pin) {
    return (
      <View style={styles.pinnedRow}>
        {left ? (
          <View style={styles.left}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
              {left}
            </ScrollView>
          </View>
        ) : null}
        {rightPanel ? (
          <View style={[styles.right, styles.panel]}>
            <View style={styles.panelClip}>
              <PanelContext.Provider value>
                {rightHeader}
                <ScrollView
                  style={styles.panelScroll}
                  contentContainerStyle={styles.panelContent}
                >
                  {right}
                </ScrollView>
              </PanelContext.Provider>
            </View>
          </View>
        ) : (
          <View style={[styles.right, styles.column]}>
            {rightHeader}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
            >
              {right}
            </ScrollView>
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      style={wide ? [styles.row, stretch && styles.rowStretch] : styles.stack}
    >
      {left ? (
        <View style={[styles.column, wide && styles.left]}>{left}</View>
      ) : null}
      {rightPanel ? (
        <View style={[styles.panel, wide && styles.right]}>
          <PanelContext.Provider value>
            {rightHeader}
            <View style={styles.panelContent}>{right}</View>
          </PanelContext.Provider>
        </View>
      ) : (
        <View style={[styles.column, wide && styles.right]}>
          {rightHeader}
          {right}
        </View>
      )}
    </View>
  );
}

// 스크롤 영역이 카드 그림자를 자르지 않게 안쪽에 여백을 주고 그만큼 바깥으로 넓힌다.
const BLEED = spacing.sm;

const useStyles = themedStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  rowStretch: { alignItems: "stretch" },
  pinnedRow: { flex: 1, flexDirection: "row", gap: spacing.md },
  stack: { gap: spacing.md },
  column: { gap: spacing.md },
  left: { flex: 2 },
  right: { flex: 3 },
  // 아래쪽은 넓히지 않는다: 두 단의 아래 끝(왼쪽 카드 바닥, 오른쪽 목록이 잘리는 선)을 같은 줄에 맞춘다.
  // 넓히면 오른쪽 목록만 아래로 더 내려와 왼쪽보다 길어 보이고 하단 버튼에 붙는다.
  scroll: {
    flex: 1,
    marginTop: -BLEED,
    marginHorizontal: -BLEED,
  },
  // flexGrow: 내용이 짧으면 카드가 단 높이를 채울 수 있다 (Card 의 fill).
  scrollContent: {
    flexGrow: 1,
    gap: spacing.md,
    paddingTop: BLEED,
    paddingHorizontal: BLEED,
  },
  // 오른쪽 단 카드 한 장. 그림자는 바깥 상자에, 둥근 모서리 자르기는 안쪽 상자에 둔다 (자르면 그림자도 잘린다).
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    ...shadows.card,
  },
  panelClip: { flex: 1, borderRadius: radius.card, overflow: "hidden" },
  panelScroll: { flex: 1 },
  panelContent: { flexGrow: 1, paddingHorizontal: spacing.lg },
}));
