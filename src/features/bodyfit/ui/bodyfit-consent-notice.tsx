import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { colors, radius, sizes, spacing } from "@/shared/ui/theme";

// Pleos 심사 가이드: 수집 항목·처리 목적·보유 기간·동의 거부 권리를 알리고 명시적인 동의를 받는다.
// 필수 동의는 등록 버튼("동의하고 등록하기")으로만 받는다. 다른 동작을 동의로 보지 않는다.
const REQUIRED_NOTICE = [
  { label: "수집 항목", text: "이름, 키, 몸무게, 앉은키, 시트 자세 기록" },
  { label: "이용 목적", text: "시트 자세 추천과 운전자별 맞춤 보정" },
  {
    label: "보관",
    text: "이 차량 안에만 암호화해 저장하고, 운전자 정보를 지우면 함께 지워져요",
  },
  { label: "거부", text: "동의하지 않으면 운전자를 등록할 수 없어요" },
] as const;

type Props = {
  /** 음성 기능을 쓸 수 없는 빌드면 선택 동의를 묻지 않는다 */
  askVoice: boolean;
  voiceConsent: boolean;
  onVoiceConsentChange: (next: boolean) => void;
};

export function BodyfitConsentNotice({
  askVoice,
  voiceConsent,
  onVoiceConsentChange,
}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.notice}>
        <AppText variant="bodyStrong" accessibilityRole="header">
          개인정보 수집·이용 안내 (필수)
        </AppText>
        {REQUIRED_NOTICE.map((row) => (
          <View key={row.label} style={styles.row}>
            <AppText variant="secondary" tone="secondary" style={styles.label}>
              {row.label}
            </AppText>
            <AppText variant="secondary" style={styles.text}>
              {row.text}
            </AppText>
          </View>
        ))}
      </View>

      {askVoice ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: voiceConsent }}
          accessibilityLabel="음성 기능 사용에 동의해요, 선택"
          onPress={() => onVoiceConsentChange(!voiceConsent)}
          style={({ pressed }) => [
            styles.check,
            pressed && styles.checkPressed,
          ]}
        >
          <View style={[styles.box, voiceConsent && styles.boxChecked]}>
            {voiceConsent ? (
              <AppText variant="bodyStrong" tone="inverse">
                ✓
              </AppText>
            ) : null}
          </View>
          <View style={styles.text}>
            <AppText variant="body">음성 기능 사용에 동의해요 (선택)</AppText>
            <AppText variant="caption" tone="tertiary">
              착좌감을 말로 답할 때 써요. 음성은 현대자동차그룹 Pleos 음성
              인식에서 처리될 수 있고, 앱은 녹음을 저장하지 않아요. 동의하지
              않아도 화면으로 모두 쓸 수 있어요
            </AppText>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  notice: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.sandLight,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  label: { minWidth: 140 },
  text: { flex: 1, minWidth: 240, gap: spacing.xs },
  check: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: sizes.touchTarget,
    paddingVertical: spacing.sm,
  },
  checkPressed: { opacity: 0.7 },
  box: {
    width: 48,
    height: 48,
    borderRadius: radius.control,
    borderWidth: 3,
    borderColor: colors.inkTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
});
