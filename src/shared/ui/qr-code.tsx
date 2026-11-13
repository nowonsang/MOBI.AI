import { StyleSheet, View } from "react-native";

import type { QrMatrix } from "./qr-matrix";
import { palettes } from "./theme";

type QrCodeProps = {
  /** qrMatrix() 로 만든 칸 배치 */
  matrix: QrMatrix;
  /** 여백을 포함한 한 변의 최대 크기(dp). 칸 크기를 정수로 맞추느라 조금 작게 그려질 수 있다 */
  size: number;
  /** 코드에 무엇이 담겼는지 (그림만으로는 뜻이 전해지지 않는다) */
  accessibilityLabel: string;
};

// QR 규격의 여백(quiet zone): 네 변에 4칸. 없으면 읽는 쪽이 코드의 끝을 찾지 못한다.
const QUIET_ZONE = 4;

// QR 코드 그림. 칸 크기를 정수 dp 로 맞춰 칸 사이에 틈이 생기지 않게 한다.
export function QrCode({ matrix, size, accessibilityLabel }: QrCodeProps) {
  const cell = Math.max(
    1,
    Math.floor(size / (matrix.size + QUIET_ZONE * 2)),
  );
  const side = cell * (matrix.size + QUIET_ZONE * 2);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.box,
        { width: side, height: side, padding: cell * QUIET_ZONE },
      ]}
    >
      {matrix.rows.map((runs, row) => (
        <View key={row} style={{ height: cell }}>
          {runs.map((run) => (
            <View
              key={run.start}
              style={[
                styles.dark,
                {
                  left: run.start * cell,
                  width: run.length * cell,
                  height: cell,
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// 주간·야간 어느 쪽에서도 주간 색(어두운 칸 + 흰 바탕)으로 그린다. 색을 뒤집은 QR 은 읽지 못하는 인식기가 많다.
// 그래서 themedStyles 를 쓰지 않는다. 야간에 밝은 면이 생기지만 코드를 찍는 동안만 보이는 작은 면이다.
const styles = StyleSheet.create({
  box: { backgroundColor: palettes.day.surface },
  dark: { position: "absolute", backgroundColor: palettes.day.ink },
});
