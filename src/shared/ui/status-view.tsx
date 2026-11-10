import { StyleSheet, View } from "react-native";

import { AppText } from "./app-text";
import { Button } from "./button";
import { colors, radius, shadows, spacing } from "./theme";
import { useCompact } from "./use-compact";

type StatusViewProps = {
  /** 무슨 일인지 한 줄 */
  title: string;
  /** 어떻게 하면 되는지 두 줄 이내 */
  description: string;
  action?: { label: string; onPress: () => void };
};

// 실패·빈 상태는 이 컴포넌트 하나로 통일한다 (같은 실패는 어디서나 같은 모양).
export function StatusView({ title, description, action }: StatusViewProps) {
  const compact = useCompact();

  return (
    <View
      style={[styles.box, { padding: compact ? spacing.md : spacing.xl }]}
      accessibilityRole="summary"
    >
      <AppText variant="heading">{title}</AppText>
      <AppText variant="secondary" tone="secondary">
        {description}
      </AppText>
      {action ? (
        // 좁은 창에서는 버튼을 상자 폭에 맞춰 글자가 줄바꿈되지 않게 한다.
        <View style={[styles.action, compact && styles.actionStretch]}>
          <Button label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  action: { marginTop: spacing.sm, alignItems: "flex-start" },
  actionStretch: { alignItems: "stretch" },
});
