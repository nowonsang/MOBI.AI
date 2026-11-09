import { StyleSheet, View } from "react-native";

import { AppText } from "./app-text";
import { Button } from "./button";
import { colors, radius, spacing } from "./theme";

type StatusViewProps = {
  /** 무슨 일인지 한 줄 */
  title: string;
  /** 어떻게 하면 되는지 두 줄 이내 */
  description: string;
  action?: { label: string; onPress: () => void };
};

// 실패·빈 상태는 이 컴포넌트 하나로 통일한다 (같은 실패는 어디서나 같은 모양).
export function StatusView({ title, description, action }: StatusViewProps) {
  return (
    <View style={styles.box} accessibilityRole="summary">
      <AppText variant="heading">{title}</AppText>
      <AppText variant="secondary" tone="secondary">
        {description}
      </AppText>
      {action ? (
        <View style={styles.action}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.control,
    backgroundColor: colors.sandLight,
  },
  action: { marginTop: spacing.sm, alignItems: "flex-start" },
});
