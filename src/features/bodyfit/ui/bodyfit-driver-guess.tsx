import { useEffect, useEffectEvent, useRef, useState } from "react";
import { View } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { IconBadge } from "@/shared/ui/icon-badge";
import { spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import {
  useStopListening,
  useVoiceDriverConfirm,
} from "../api/bodyfit.mutations";
import type { DriverGuessReason } from "../model/bodyfit-identify";

/** 이만큼 기다렸다가 추측한 운전자로 넘어간다. 잘못 골랐으면 그 사이에 "다른 사람이에요"를 누른다 */
const AUTO_START_SECONDS = 3;

const REASON_COPY: Record<DriverGuessReason, string> = {
  only: "등록된 운전자가 한 분이에요",
  "usual-time": "이 시간에 자주 타셨어요",
  "after-last": "앞사람 다음에 자주 타셨어요",
  pattern: "평소 타시는 패턴과 비슷해요",
};

type BodyfitDriverGuessProps = {
  name: string;
  reason: DriverGuessReason;
  /** 모델이 계산한 확률 (0~1) */
  confidence: number;
  /** 저절로 넘어갈지. 주차(P) 중이고 확률이 충분히 높을 때만 true. 낮으면 묻기만 한다 */
  autoStart: boolean;
  /**
   * "○○님이시죠?"를 음성으로 묻고 대답을 들을지. 음성 기능이 있는 빌드에서, 추측한 운전자가 음성 기능에 동의했고
   * 주차(P) 중일 때만 true.
   */
  askByVoice: boolean;
  onAccept: () => void;
  onDismiss: () => void;
};

/**
 * 운전석에 앉은 사람을 기록으로 추측해 보여 준다 (A-6 자동 인식의 카메라 없는 1단계).
 * 몇 초 뒤 그 운전자의 맞춤 자세 화면으로 넘어간다. 시트는 그 화면에서 운전자가 확인한 뒤에만 움직인다.
 */
export function BodyfitDriverGuess({
  name,
  reason,
  confidence,
  autoStart,
  askByVoice,
  onAccept,
  onDismiss,
}: BodyfitDriverGuessProps) {
  const styles = useStyles();
  const [secondsLeft, setSecondsLeft] = useState(AUTO_START_SECONDS);
  const accept = useEffectEvent(onAccept);
  const voice = useVoiceDriverConfirm();
  const stopListening = useStopListening();
  const asked = useRef(false);
  const listening = voice.isPending;

  // 카드가 뜨면 한 번만 묻는다. 긍정이면 바로 넘어가고, 부정이면 목록에서 고르게 한다.
  // 애매하거나 음성이 실패하면 아무것도 바꾸지 않는다 (버튼과 카운트다운은 그대로).
  const answer = useEffectEvent(() =>
    voice.mutate(
      { name },
      {
        onSuccess: (result) => {
          if (result === "yes") onAccept();
          else if (result === "no") onDismiss();
        },
      },
    ),
  );
  useEffect(() => {
    if (!askByVoice || asked.current) return;
    asked.current = true;
    answer();
  }, [askByVoice]);

  // 화면을 떠나면 마이크를 닫는다 (다른 화면에서 대답이 들어와 엉뚱하게 넘어가지 않게).
  const closeMic = useEffectEvent(() => {
    if (asked.current) stopListening.mutate();
  });
  useEffect(() => () => closeMic(), []);

  useEffect(() => {
    // 묻고 듣는 동안에는 기다린다: 대답하기 전에 저절로 넘어가지 않게.
    if (!autoStart || listening) return;
    if (secondsLeft <= 0) {
      accept();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [autoStart, listening, secondsLeft]);

  return (
    <Card>
      <View style={styles.body} accessibilityLiveRegion="polite">
        <View style={styles.who}>
          <IconBadge glyph={name.slice(0, 1)} tone="tint" />
          <View style={styles.text}>
            <AppText variant="heading">{name}님이시죠?</AppText>
            <AppText variant="secondary" tone="tertiary">
              {REASON_COPY[reason]} · 확률 {Math.round(confidence * 100)}%
            </AppText>
          </View>
        </View>
        {listening ? (
          <AppText variant="secondary" tone="secondary">
            {'듣고 있어요. "응" 또는 "아니"라고 말해 주세요'}
          </AppText>
        ) : autoStart ? (
          <AppText variant="secondary" tone="secondary">
            {secondsLeft}초 뒤 {name}님 자세로 넘어가요
          </AppText>
        ) : (
          <AppText variant="secondary" tone="secondary">
            맞으면 눌러 주세요
          </AppText>
        )}
      </View>
      <View style={styles.actions}>
        <Button
          label="다른 사람이에요"
          variant="secondary"
          onPress={onDismiss}
        />
        <Button label="맞아요" onPress={onAccept} />
      </View>
    </Card>
  );
}

const useStyles = themedStyles(() => ({
  body: { gap: spacing.sm },
  who: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  text: { flex: 1, gap: spacing.xs },
  // 터치 대상 사이는 최소 24dp. 좁은 칸에서는 줄을 바꿔 쌓는다.
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: spacing.md,
    marginTop: spacing.md,
  },
}));
