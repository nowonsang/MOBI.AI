import { View } from "react-native";

import { themedStyles } from "./use-theme";

// 카드 안 목록 행 사이의 옅은 구분선. 장식이라 스크린리더에서는 건너뛴다.
export function Divider() {
  const styles = useStyles();
  return (
    <View
      style={styles.line}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}

const useStyles = themedStyles((colors) => ({
  line: { height: 1, backgroundColor: colors.line },
}));
