import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { useAppDispatch, useAppSelector } from "@/core/store/hooks";
import type { DriverSeatState } from "@/shared/pleos/pleos.types";
import { usePleosEvent } from "@/shared/pleos/use-pleos-event";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { colors, radius, spacing } from "@/shared/ui/theme";

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
  const dispatch = useAppDispatch();
  const pending = useAppSelector(selectPendingFeedback);
  const listen = useVoiceSeatFeedback();
  const stopListening = useStopListening();
  const move = useMoveSeat();
  const record = useRecordSeatAdjustment();
  const [partial, setPartial] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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
            setMessage(interpretation.reply);
          }
          void speakQuietly(interpretation.reply);
        },
      },
    );
  };

  const applyPending = () => {
    if (!pending || !seat) return;
    const target = applyNudges(toSeatRatios(seat), pending.nudges);
    Alert.alert(
      "시트를 움직일게요",
      "시트 주변에 물건이나 사람이 끼지 않았는지 확인해 주세요",
      [
        { text: "취소", style: "cancel" },
        {
          text: "조절하기",
          onPress: () =>
            move.mutate(target, {
              onSuccess: () => {
                record.mutate({ profile, source: "voice" });
                dispatch(feedbackDismissed());
                setMessage("말씀하신 대로 조절했어요. 다음 추천에 반영할게요");
              },
            }),
        },
      ],
    );
  };

  const error = listen.error ?? move.error;

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <AppText variant="heading" accessibilityRole="header">
          불편한 곳이 있나요?
        </AppText>
        <AppText variant="secondary" tone="secondary">
          말로 알려 주시면 시트를 조절하고 다음 추천에 반영해요
        </AppText>
      </View>

      {pending ? (
        <View style={styles.card}>
          <AppText variant="bodyStrong">{pending.reply}</AppText>
          {!parked ? (
            <AppText variant="secondary" tone="secondary">
              차를 세우고 기어를 P로 바꾸면 조절할 수 있어요
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button
              label="이대로 조절하기"
              variant="secondary"
              onPress={applyPending}
              disabled={!parked || !seat}
              loading={move.isPending}
            />
            <Button
              label="취소하기"
              variant="secondary"
              onPress={() => dispatch(feedbackDismissed())}
              disabled={move.isPending}
            />
          </View>
        </View>
      ) : listen.isPending ? (
        <View style={styles.card} accessibilityLiveRegion="polite">
          <AppText variant="bodyStrong">듣고 있어요…</AppText>
          {partial ? (
            <AppText variant="secondary" tone="secondary">
              {partial}
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <Button
              label="그만 듣기"
              variant="secondary"
              onPress={() => stopListening.mutate()}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            label="말로 알려 주기"
            variant="secondary"
            onPress={startListening}
          />
        </View>
      )}

      {message ? (
        <AppText variant="secondary" tone="secondary" accessibilityLiveRegion="polite">
          {message}
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="secondary" tone="danger" accessibilityLiveRegion="polite">
          {describeBodyfitError(error).title}.{" "}
          {describeBodyfitError(error).description}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  heading: { gap: spacing.xs },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.control,
    backgroundColor: colors.sandLight,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
});
