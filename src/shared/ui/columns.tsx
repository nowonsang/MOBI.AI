import type { ReactNode } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

import { layout, spacing } from "./theme";
import { usePinnedLayout } from "./use-pinned-layout";

type ColumnsProps = {
  /** 요약·그림 (넓은 창에서 왼쪽 40%) */
  left: ReactNode;
  /** 목록·선택지 (넓은 창에서 오른쪽 60%) */
  right: ReactNode;
  /** 오른쪽 단 맨 위에 두는 것 (예: 탭 막대). pinned 일 때 스크롤해도 자리를 지킨다 */
  rightHeader?: ReactNode;
  /**
   * 단마다 따로 스크롤한다 (Screen 의 pinned 와 함께 쓴다).
   * 긴 목록을 내려도 왼쪽 요약과 오른쪽 탭이 화면에 남는다. 좁거나 낮은 창에서는 꺼진다.
   */
  pinned?: boolean;
};

// 가로로 넓은 차량 화면을 2단으로 나눈다. 좁은 창(세로 분할 창, 휴대폰)에서는 위아래로 쌓는다.
export function Columns({ left, right, rightHeader, pinned }: ColumnsProps) {
  const wide = useWindowDimensions().width >= layout.twoColumnWidth;
  const pin = usePinnedLayout() && pinned;

  if (pin) {
    return (
      <View style={styles.pinnedRow}>
        <View style={styles.left}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            {left}
          </ScrollView>
        </View>
        <View style={[styles.right, styles.column]}>
          {rightHeader}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
            {right}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={wide ? styles.row : styles.stack}>
      <View style={[styles.column, wide && styles.left]}>{left}</View>
      <View style={[styles.column, wide && styles.right]}>
        {rightHeader}
        {right}
      </View>
    </View>
  );
}

// 스크롤 영역이 카드 그림자를 자르지 않게 안쪽에 여백을 주고 그만큼 바깥으로 넓힌다.
const BLEED = spacing.sm;

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  pinnedRow: { flex: 1, flexDirection: "row", gap: spacing.md },
  stack: { gap: spacing.md },
  column: { gap: spacing.md },
  left: { flex: 2 },
  right: { flex: 3 },
  scroll: { flex: 1, margin: -BLEED },
  // flexGrow: 내용이 짧으면 카드가 단 높이를 채울 수 있다 (Card 의 fill).
  scrollContent: { flexGrow: 1, gap: spacing.md, padding: BLEED },
});
