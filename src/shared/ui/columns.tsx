import type { ReactNode } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";

import { layout, spacing } from "./theme";

type ColumnsProps = {
  /** 요약·그림 (넓은 창에서 왼쪽 40%) */
  left: ReactNode;
  /** 목록·선택지 (넓은 창에서 오른쪽 60%) */
  right: ReactNode;
};

// 가로로 넓은 차량 화면을 2단으로 나눈다. 좁은 창(세로 분할 창, 휴대폰)에서는 위아래로 쌓는다.
export function Columns({ left, right }: ColumnsProps) {
  const wide = useWindowDimensions().width >= layout.twoColumnWidth;
  return (
    <View style={wide ? styles.row : styles.stack}>
      <View style={[styles.column, wide && styles.left]}>{left}</View>
      <View style={[styles.column, wide && styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  stack: { gap: spacing.md },
  column: { gap: spacing.md },
  left: { flex: 2 },
  right: { flex: 3 },
});
