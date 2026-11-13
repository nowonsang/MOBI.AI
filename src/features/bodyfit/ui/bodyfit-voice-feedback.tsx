import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { useAppDispatch, useAppSelector } from "@/core/store/hooks";
import { canControlComfort } from "@/shared/config/app-variant";
import type { DriverSeatState } from "@/shared/pleos/pleos.types";
import { usePleosEvent } from "@/shared/pleos/use-pleos-event";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { IconBadge } from "@/shared/ui/icon-badge";
import { radius, shadows, sizes, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import {
  useApplyComfort,
  useMoveSeat,
  useRecordSeatAdjustment,
  useStopListening,
  useVoiceAdjustment,
} from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { speakQuietly } from "../api/bodyfit.voice";
import { applyNudges, toSeatRatios } from "../model/bodyfit-seat";
import {
  comfortDismissed,
  comfortProposed,
  feedbackDismissed,
  feedbackProposed,
  selectDriveContext,
  selectPendingComfort,
  selectPendingFeedback,
} from "../model/bodyfit-session.slice";
import {
  comfortItemLabel,
  describeComfortValue,
} from "../model/bodyfit-voice-comfort";
import type { BodyProfile } from "../model/bodyfit.types";
import {
  describeBodyfitError,
  describeComfortError,
} from "./bodyfit-error-copy";
import { SEAT_MOVE_CONFIRM } from "./bodyfit-confirm-copy";

type BodyfitVoiceFeedbackProps = {
  profile: BodyProfile;
  seat: DriverSeatState | undefined;
  parked: boolean;
};

// "허리가 불편해" 같은 말을 조절안으로 바꾸고, 운전자가 확인하면 주차 상태에서만 시트를 움직인다.
// "추워요", "핸들 열선 켜 줘" 같은 온도 이야기는 온도 조절안으로 바꾸고, 운전자가 누르면 주차 상태에서만 맞춘다 (E-4).
export function BodyfitVoiceFeedback({
  profile,
  seat,
  parked,
}: BodyfitVoiceFeedbackProps) {
  const styles = useStyles();
  const dispatch = useAppDispatch();
  const pending = useAppSelector(selectPendingFeedback);
  const context = useAppSelector(selectDriveContext);
  const pendingComfort = useAppSelector(selectPendingComfort);
  const comfortState = useQuery({
    ...bodyfitQueries.comfort(),
    enabled: pendingComfort !== null,
  }).data;
  const listen = useVoiceAdjustment();
  const applyComfort = useApplyComfort();
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
    applyComfort.reset();
    listen.mutate(
      { profileId: profile.id },
      {
        onSuccess: (result) => {
          const reply =
            result.kind === "seat"
              ? result.interpretation.reply
              : result.kind === "comfort"
                ? result.plan.reply
                : result.reply;
          if (
            result.kind === "seat" &&
            result.interpretation.nudges.length > 0
          ) {
            dispatch(feedbackProposed(result.interpretation));
          } else if (
            result.kind === "comfort" &&
            result.plan.items.length > 0
          ) {
            dispatch(comfortProposed(result.plan));
          } else {
            setMessage({ text: reply, done: false });
          }
          void speakQuietly(reply);
        },
      },
    );
  };

  // 온도 조절안도 음성에서 왔다: 바뀔 값을 화면에 보여 주고 운전자가 누른 뒤에만 차량에 보낸다. 네이티브가 기어 P 를 다시 확인한다.
  const applyPendingComfort = () => {
    if (!pendingComfort) return;
    applyComfort.mutate(pendingComfort.changes, {
      onSuccess: () => {
        dispatch(comfortDismissed());
        setMessage({ text: "온도를 바꿨어요", done: true });
        void speakQuietly("온도를 바꿨어요");
      },
    });
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
          text: "시트를 조절했어요. 다음 추천에도 반영할게요",
          done: true,
        });
      },
    });
  };

  const error = listen.error ?? move.error;
  const errorCopy = applyComfort.error
    ? describeComfortError(applyComfort.error)
    : error
      ? describeBodyfitError(error)
      : null;

  const proposing = pending !== null || pendingComfort !== null;
  const listening = !proposing && listen.isPending;
  const example = canControlComfort
    ? "예: “허리가 불편해”, “추워요”, “핸들 열선 켜 줘”"
    : "예: “허리가 불편해”, “조금 더 낮게”";

  // 평소에는 한 줄(말하기 버튼 + 안내)만 차지한다. 듣는 중과 조절안이 있을 때만 커진다.
  return (
    <View style={[styles.card, listening && styles.cardListening]}>
      <ConfirmDialog
        visible={confirming}
        title={SEAT_MOVE_CONFIRM.title}
        description={SEAT_MOVE_CONFIRM.description}
        confirmLabel="조절하기"
        onConfirm={applyPending}
        onCancel={() => setConfirming(false)}
      />

      {pending ? (
        // 음성으로 만든 조절안. 운전자가 확인 창에서 고르기 전에는 움직이지 않는다.
        <>
          <AppText variant="secondary" tone="secondary">
            이렇게 조절할까요?
          </AppText>
          <AppText variant="bodyStrong">{pending.reply}</AppText>
          {!parked ? (
            <AppText variant="caption" tone="tertiary">
              차를 세우고 기어를 P로 바꾸면 조절할 수 있어요
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                label="취소하기"
                variant="secondary"
                onPress={() => dispatch(feedbackDismissed())}
                disabled={move.isPending}
              />
            </View>
            <View style={styles.action}>
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
        </>
      ) : pendingComfort ? (
        // 음성으로 만든 온도 조절안. 운전자가 누르기 전에는 바꾸지 않는다.
        <>
          <AppText variant="secondary" tone="secondary">
            이렇게 바꿀까요?
          </AppText>
          <View style={styles.changes}>
            {pendingComfort.items.map(({ key, from, to }) => (
              <View
                key={key}
                style={styles.change}
                accessible
                accessibilityLabel={
                  comfortState
                    ? `${comfortItemLabel(key)}, 지금 ${describeComfortValue(key, from, comfortState)}에서 ${describeComfortValue(key, to, comfortState)}`
                    : comfortItemLabel(key)
                }
              >
                <AppText variant="caption">{comfortItemLabel(key)}</AppText>
                {comfortState ? (
                  <AppText variant="bodyStrong">
                    {describeComfortValue(key, from, comfortState)} →{" "}
                    {describeComfortValue(key, to, comfortState)}
                  </AppText>
                ) : null}
              </View>
            ))}
          </View>
          {!parked ? (
            <AppText variant="caption" tone="tertiary">
              차를 세우고 기어를 P로 바꾸면 맞출 수 있어요
            </AppText>
          ) : null}
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                label="취소하기"
                variant="secondary"
                onPress={() => dispatch(comfortDismissed())}
                disabled={applyComfort.isPending}
              />
            </View>
            <View style={styles.action}>
              <Button
                label="이대로 맞추기"
                variant="secondary"
                onPress={applyPendingComfort}
                disabled={!parked}
                loading={applyComfort.isPending}
                accessibilityHint="보이는 대로 열선과 온도, 바람을 바꿔요"
              />
            </View>
          </View>
        </>
      ) : listening ? (
        <View style={styles.row} accessibilityLiveRegion="polite">
          <IconBadge glyph="●" tone="primary" />
          <View style={styles.rowText}>
            <AppText variant="bodyStrong">듣고 있어요</AppText>
            {partial ? (
              <AppText variant="secondary" numberOfLines={2}>
                “{partial}”
              </AppText>
            ) : null}
          </View>
          <Button
            label="그만 듣기"
            variant="secondary"
            onPress={() => stopListening.mutate()}
          />
        </View>
      ) : (
        // 줄 전체가 말하기 버튼이다 (터치 대상 76dp 이상). 끝난 뒤의 답도 이 줄에 보여 준다.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            message ? `${message.text}. 다시 말로 알려 주기` : "말로 알려 주기"
          }
          accessibilityHint={
            canControlComfort
              ? "자세나 온도를 말하면 바꿀 내용을 먼저 보여 줘요"
              : "말하면 바꿀 내용을 먼저 보여 줘요"
          }
          onPress={startListening}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <IconBadge
            glyph={message?.done ? "✓" : "말"}
            tone={message?.done ? "success" : "primary"}
          />
          <View style={styles.rowText} accessibilityLiveRegion="polite">
            <AppText variant="bodyStrong">
              {message ? message.text : "불편한 곳을 말로 알려 주세요"}
            </AppText>
            <AppText variant="caption" tone="tertiary">
              {message?.done ? "더 있으면 눌러서 다시 말해 주세요" : example}
            </AppText>
          </View>
        </Pressable>
      )}

      {/* 듣는 중(옅은 파랑 면)에는 지난 오류를 감춘다: 그 면 위 글자 조합은 검사하지 않았다. */}
      {errorCopy && !listening ? (
        <View style={styles.rowText} accessibilityLiveRegion="polite">
          <AppText variant="bodyStrong" tone="danger">
            {errorCopy.title}
          </AppText>
          <AppText variant="secondary" tone="secondary">
            {errorCopy.description}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  // 공용 Card 보다 여백이 작은 한 줄짜리 카드 (이 파일 전용). 듣는 중에는 면 전체가 옅은 파랑이 된다.
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  cardListening: { backgroundColor: colors.primaryTint },
  // 아이콘 원 + 글 (+ 버튼) 한 줄. 좁은 창에서는 버튼이 아래로 내려간다.
  row: {
    minHeight: sizes.touchTarget,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radius.control,
  },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  rowText: { flexBasis: 240, flexGrow: 1, flexShrink: 1, gap: spacing.xs },
  // 바뀔 곳 타일: 이름 + "지금 → 바뀔 값". 온도·무드등 카드의 달라지는 타일과 같은 모양이다.
  changes: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  change: {
    flexBasis: 240,
    flexGrow: 1,
    minHeight: sizes.touchTarget,
    padding: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.primaryTint,
  },
  // 터치 대상 사이는 최소 24dp. 두 버튼이 폭을 반씩 나눠 갖고, 좁으면 위아래로 쌓인다.
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  action: { flexBasis: 240, flexGrow: 1 },
}));
