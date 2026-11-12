import { Modal, Pressable, View } from "react-native";

import { AppText } from "./app-text";
import { Button } from "./button";
import { layout, radius, shadows, spacing } from "./theme";
import { useCompact } from "./use-compact";
import { themedStyles } from "./use-theme";

type ConfirmDialogProps = {
  visible: boolean;
  /** 무엇을 할지 한 줄 (예: "시트를 움직일게요") */
  title: string;
  /** 확인 전에 알아야 할 것 두 줄 이내 */
  description: string;
  /** 동사형 확인 버튼 문구 (예: "맞추기", "지우기") */
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

// 차량 화면용 확인 창. 시스템 Alert 는 글자·버튼이 작아(차량 기준 32dp·76dp 미달) 쓰지 않는다.
// 바깥을 누르거나 뒤로 가기를 누르면 취소로 본다 (확인은 버튼으로만 받는다).
export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel,
  cancelLabel = "취소",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const compact = useCompact();
  const styles = useStyles();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable
        style={styles.backdrop}
        onPress={onCancel}
        accessibilityLabel="닫기"
        accessibilityRole="button"
      >
        {/* 안쪽을 눌러도 닫히지 않게 이벤트를 여기서 멈춘다. */}
        <Pressable
          style={[styles.box, { padding: compact ? spacing.md : spacing.xl }]}
          onPress={() => undefined}
          accessible={false}
        >
          <View style={styles.text}>
            <AppText variant="heading" accessibilityRole="header">
              {title}
            </AppText>
            <AppText variant="secondary" tone="secondary">
              {description}
            </AppText>
          </View>
          <View style={[styles.actions, compact && styles.actionsStacked]}>
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
            <Button label={confirmLabel} onPress={onConfirm} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = themedStyles((colors) => ({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: layout.gutterCompact,
    // 뒤 화면을 어둡게 가린다.
    backgroundColor: colors.scrim,
  },
  box: {
    width: "100%",
    maxWidth: layout.narrow,
    gap: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  text: { gap: spacing.sm },
  // 터치 대상 사이는 최소 24dp. 주 버튼을 오른쪽(좁은 창에서는 아래)에 둔다.
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.md },
  actionsStacked: { flexDirection: "column", alignItems: "stretch" },
}));
