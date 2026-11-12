import { useState } from "react";
import { View } from "react-native";

import { useAppDispatch, useAppSelector } from "@/core/store/hooks";
import type { DriverSeatState } from "@/shared/pleos/pleos.types";
import { usePleosEvent } from "@/shared/pleos/use-pleos-event";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { IconBadge } from "@/shared/ui/icon-badge";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import {
  useMoveSeat,
  useRecordSeatAdjustment,
  useStopListening,
  useVoiceSeatFeedback,
} from "../api/bodyfit.mutations";
import { speakQuietly } from "../api/bodyfit.voice";
import { applyNudges, toSeatRatios } from "../model/bodyfit-seat";
import {
  feedbackDismissed,
  feedbackProposed,
  selectDriveContext,
  selectPendingFeedback,
} from "../model/bodyfit-session.slice";
import type { BodyProfile } from "../model/bodyfit.types";
import { describeBodyfitError } from "./bodyfit-error-copy";

type BodyfitVoiceFeedbackProps = {
  profile: BodyProfile;
  seat: DriverSeatState | undefined;
  parked: boolean;
};

// "허리가 불편해" 같은 말을 조절안으로 바꾸고, 운전자가 확인하면 주차 상태에서만 시트를 움직인다.
export function BodyfitVoiceFeedback({
  profile,
  seat,
  parked,
}: BodyfitVoiceFeedbackProps) {
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const pending = useAppSelector(selectPendingFeedback);
  const context = useAppSelector(selectDriveContext);
  const listen = useVoiceSeatFeedback();
  const stopListening = useStopListening();
  const move = useMoveSeat();
  const record = useRecordSeatAdjustment();
  const [partial, setPartial] = useState("");
  // done: 시트를 조절해 끝난 안내(✓ 표시), 아니면 조절할 곳이 없다는 답
  const [message, setMessage] = useState<{
    text: string;
    done: boolean;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);

  usePleosEvent("onSpeechPartial", (event) => setPartial(event.text));

  const startListening = () => {
    setPartial("");
    setMessage(null);
    listen.mutate(
      {},
      {
        onSuccess: ({ interpretation }) => {
          if (interpretation.nudges.length > 0) {
            dispatch(feedbackProposed(interpretation));
          } else {
            setMessage({ text: interpretation.reply, done: false });
          }
          void speakQuietly(interpretation.reply);
        },
      },
    );
  };

  // 음성 결과는 신뢰하지 않는 입력이다: 조절안을 화면에 보여 주고 운전자가 확인 창에서 고른 뒤에만 움직인다.
  const applyPending = () => {
    setConfirming(false);
    if (!pending || !seat) return;
    const target = applyNudges(toSeatRatios(seat), pending.nudges);
    move.mutate(target, {
      onSuccess: () => {
        record.mutate({ profile, source: "voice", context });
        dispatch(feedbackDismissed());
        setMessage({
          text: "말씀하신 대로 조절했어요. 다음 추천에 반영할게요",
          done: true,
        });
      },
    });
  };

  const error = listen.error ?? move.error;
  const errorCopy = error ? describeBodyfitError(error) : null;

  return (
    <Card>
      <ConfirmDialog
        visible={confirming}
        title="시트를 움직일게요"
        description="시트 주변에 물건이나 사람이 끼지 않았는지 확인해 주세요"
        confirmLabel="조절하기"
        onConfirm={applyPending}
        onCancel={() => setConfirming(false)}
      />
      <View style={styles.heading}>
        <IconBadge glyph="말" tone="tint" />
        <View style={styles.headingText}>
          <AppText variant="heading" accessibilityRole="header">
            불편한 곳이 있나요?
          </AppText>
          <AppText variant="secondary" tone="secondary">
            말로 알려 주시면 조절안을 먼저 보여 드려요
          </AppText>
        </View>
      </View>

      {pending ? (
        // 음성으로 만든 조절안. 운전자가 확인 창에서 고르기 전에는 움직이지 않는다.
        <View style={[styles.box, styles.proposal]}>
          <AppText variant="caption" tone="tertiary">
            이렇게 조절할까요?
          </AppText>
          <AppText variant="bodyStrong">{pending.reply}</AppText>
          {!parked ? (
            <AppText variant="secondary" tone="secondary">
              차를 세우고 기어를 P로 바꾸면 조절할 수 있어요
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button
              label="취소하기"
              variant="secondary"
              onPress={() => dispatch(feedbackDismissed())}
              disabled={move.isPending}
            />
            <Button
              label="이대로 조절하기"
              variant="secondary"
              onPress={() => setConfirming(true)}
              disabled={!parked || !seat}
              loading={move.isPending}
              accessibilityHint="확인 창에서 한 번 더 확인한 뒤 시트를 움직여요"
            />
          </View>
        </View>
      ) : listen.isPending ? (
        <View
          style={[styles.box, styles.listening]}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.status}>
            <IconBadge glyph="●" tone="primary" />
            <View style={styles.headingText}>
              <AppText variant="bodyStrong">듣고 있어요</AppText>
              {partial ? (
                <AppText variant="secondary">“{partial}”</AppText>
              ) : null}
            </View>
          </View>
          <View style={styles.actions}>
            <Button
              label="그만 듣기"
              variant="secondary"
              onPress={() => stopListening.mutate()}
            />
          </View>
        </View>
      ) : (
        <>
          <AppText variant="caption" tone="tertiary">
            예: “허리가 불편해”, “조금 더 낮게”
          </AppText>
          <View style={styles.actions}>
            <Button
              label="말로 알려 주기"
              variant="secondary"
              onPress={startListening}
            />
          </View>
        </>
      )}

      {message ? (
        <View style={styles.status} accessibilityLiveRegion="polite">
          {message.done ? <IconBadge glyph="✓" tone="success" /> : null}
          <AppText
            variant={message.done ? "bodyStrong" : "secondary"}
            tone={message.done ? "default" : "secondary"}
            style={styles.statusText}
          >
            {message.text}
          </AppText>
        </View>
      ) : null}
      {errorCopy ? (
        <View style={styles.headingText} accessibilityLiveRegion="polite">
          <AppText variant="bodyStrong" tone="danger">
            {errorCopy.title}
          </AppText>
          <AppText variant="secondary" tone="secondary">
            {errorCopy.description}
          </AppText>
        </View>
      ) : null}
    </Card>
  );
}

const useStyles = themedStyles((colors) => ({
  heading: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  headingText: { flexShrink: 1, gap: spacing.xs },
  // 듣는 중·조절안은 카드 안의 옅은 면으로 구분한다 (글자는 theme.test 가 검사하는 조합).
  box: { gap: spacing.sm, padding: spacing.lg, borderRadius: radius.control },
  listening: { backgroundColor: colors.primaryTint },
  proposal: { backgroundColor: colors.fill },
  status: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  statusText: { flexShrink: 1 },
  // 터치 대상 사이는 최소 24dp
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
}));
