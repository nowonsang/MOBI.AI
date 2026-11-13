import { Pressable, View } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { Card } from "@/shared/ui/card";
import { Divider } from "@/shared/ui/divider";
import { radius, sizes, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

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

// 카메라는 선택 기능이다. 쓰지 않으면 켜지지 않고, 권한은 "카메라로 재기"를 누를 때 차량이 따로 묻는다.
// 자세 인식 도구(Google ML Kit)는 사진을 보내지 않지만 사용 통계는 보낼 수 있어 함께 알린다 (ML Kit 약관의 고지 의무).
const CAMERA_NOTICE = {
  label: "카메라 (선택)",
  text: "'카메라로 재기'를 누를 때만 켜요. 촬영한 화면은 저장하지 않고 이 차량 안에서만 분석하며, 추정한 앉은키만 저장해요. 자세 인식 도구(Google ML Kit)가 기기 종류·성능 같은 사용 통계를 Google 에 보낼 수 있지만 화면과 관절 값은 보내지 않아요",
} as const;

type Props = {
  /** 카메라로 재기를 쓸 수 있는 빌드·기기에서만 카메라 사용을 알린다 */
  showCamera: boolean;
  /** 음성 기능을 쓸 수 없는 빌드면 선택 동의를 묻지 않는다 */
  askVoice: boolean;
  voiceConsent: boolean;
  onVoiceConsentChange: (next: boolean) => void;
};

// 체형 정보 카드와 같은 모양의 카드로 둔다. 안내 → (선택) 음성 동의 순서로 위에서 아래로 읽힌다.
export function BodyfitConsentNotice({
  showCamera,
  askVoice,
  voiceConsent,
  onVoiceConsentChange,
}: Props) {
  const styles = useStyles();
  return (
    <Card title="개인정보 수집·이용 안내 (필수)">
      {/* 항목 사이(sm)는 띄우고, 항목 이름과 내용은 한 줄에 붙여 표처럼 읽히게 한다. */}
      <View style={styles.notice}>
        {[...REQUIRED_NOTICE, ...(showCamera ? [CAMERA_NOTICE] : [])].map((row) => (
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
        <>
          <Divider />
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
                착좌감을 말로 답할 때 써요. 음성은 Pleos 음성
                인식(현대자동차그룹)에서 처리될 수 있어요. 동의하지 않아도
                화면으로 쓸 수 있어요
              </AppText>
            </View>
          </Pressable>
        </>
      ) : null}
    </Card>
  );
}

// 체크 칸: Pleos 아이콘 그리드(48dp) 크기. 누르는 범위는 행 전체(76dp 이상)다.
const CHECK_BOX = 48;

const useStyles = themedStyles((colors) => ({
  notice: { gap: spacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  label: { minWidth: 140 },
  text: { flex: 1, minWidth: 240, gap: spacing.xs },
  check: {
    flexDirection: "row",
    // 설명이 여러 줄이어도 체크 칸은 제목 줄 옆에 둔다.
    alignItems: "flex-start",
    gap: spacing.md,
    minHeight: sizes.touchTarget,
    paddingVertical: spacing.xs,
    borderRadius: radius.control,
  },
  // Pleos 인터랙션 가이드: 눌린 요소는 배경색을 바꾼다.
  checkPressed: { backgroundColor: colors.surfaceMuted },
  box: {
    width: CHECK_BOX,
    height: CHECK_BOX,
    borderRadius: radius.control,
    borderWidth: 3,
    borderColor: colors.inkTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
}));
