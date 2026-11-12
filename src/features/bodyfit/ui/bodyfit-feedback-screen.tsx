import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { useAppDispatch, useAppSelector } from "@/core/store/hooks";
import { isPleosAvailable } from "@/shared/pleos/pleos";
import { useGear } from "@/shared/pleos/use-gear";
import { useUxRestrictions } from "@/shared/pleos/use-ux-restrictions";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ToggleChip } from "@/shared/ui/chip";
import { Columns } from "@/shared/ui/columns";
import { Screen } from "@/shared/ui/screen";
import { StatusView } from "@/shared/ui/status-view";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { useRecordSeatAdjustment } from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { COMFORT_SCREEN_QUESTION } from "../model/bodyfit-drive";
import {
  DEFAULT_DRIVE_CONTEXT,
  DRIVE_CONTEXT_LABEL,
} from "../model/bodyfit-drive-context";
import {
  driveContextSelected,
  selectDriveContext,
} from "../model/bodyfit-session.slice";
import {
  TOUCH_FEEDBACK_CHOICES,
  nudgesForTouchChoices,
  toggleTouchChoice,
  type TouchFeedbackChoiceId,
} from "../model/bodyfit-touch-feedback";
import type { DriveContext } from "../model/bodyfit.types";
import { describeBodyfitError } from "./bodyfit-error-copy";
import { BodyfitSeatImage } from "./bodyfit-seat-image";

// 선택지 앞에 붙이는 방향 기호. 뜻은 옆 글자가 전한다.
const CHOICE_GLYPH: Record<TouchFeedbackChoiceId, string> = {
  "backrest-increase": "↑",
  "backrest-decrease": "↓",
  "foreAft-increase": "→",
  "foreAft-decrease": "←",
  "height-increase": "▲",
  "height-decrease": "▼",
};

/**
 * D-1 주행 후 질문 + D-2 터치 피드백.
 * 시트를 움직이지 않고 "지금 자세 + 고른 방향"을 기록에 남겨 다음 추천을 보정한다 (시트 제어 권한 없이 동작).
 */
export function BodyfitFeedbackScreen({
  profileId,
  drivenContext,
}: {
  profileId: string;
  /** 주행이 끝나 뜬 질문이면 그 주행을 출발할 때의 상황. 운전자가 직접 열었으면 null */
  drivenContext: DriveContext | null;
}) {
  const styles = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const vehicleConnected = isPleosAvailable();
  const selectedContext = useAppSelector(selectDriveContext);
  // 답은 방금 달린 상황의 기록으로 남긴다 (C-5). 직접 열었으면 지금 고른 상황이다.
  const context = drivenContext ?? selectedContext;
  const profile = useQuery(bodyfitQueries.profile(profileId));
  const gear = useGear();
  const restrictions = useUxRestrictions();
  const record = useRecordSeatAdjustment();
  const [selected, setSelected] = useState<TouchFeedbackChoiceId[]>([]);
  // 답한 뒤의 화면: comfortable = 편했어요, adjusted = 바꿀 곳을 골랐어요
  const [answered, setAnswered] = useState<"comfortable" | "adjusted" | null>(
    null,
  );

  if (profile.isPending) {
    return (
      <Screen title={COMFORT_SCREEN_QUESTION}>
        <View style={styles.skeleton} accessibilityLabel="불러오는 중" />
      </Screen>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <Screen title="운전자 정보를 찾지 못했어요" width="narrow">
        <StatusView
          title="운전자 정보가 없어요"
          description="목록에서 운전자를 다시 골라 주세요"
          action={{
            label: "운전자 목록으로",
            onPress: () => router.replace("/bodyfit"),
          }}
        />
      </Screen>
    );
  }

  const driver = profile.data;
  // 주차 중에만 묻는다: 주행 중 화면 조작을 요구하지 않는다 (S-5).
  const parked = gear === "park" && !restrictions.noSetup;
  const canAnswer = vehicleConnected && parked;

  const submit = (choices: readonly TouchFeedbackChoiceId[]) =>
    record.mutate(
      {
        profile: driver,
        source: "touch",
        context,
        nudges: nudgesForTouchChoices(choices),
      },
      {
        onSuccess: () =>
          setAnswered(choices.length > 0 ? "adjusted" : "comfortable"),
      },
    );

  if (answered) {
    return (
      <Screen
        title={
          answered === "adjusted"
            ? "다음 추천에 반영했어요"
            : "알겠어요. 지금 자세를 기억할게요"
        }
        description={
          answered === "adjusted"
            ? "시트는 그대로예요. 지금 바로 맞추려면 안내를 받아 보세요"
            : "다음에도 지금 자세에 가깝게 추천해 드려요"
        }
        width="narrow"
        footer={
          answered === "adjusted" ? (
            <>
              <Button
                label="나중에 하기"
                variant="secondary"
                onPress={() => router.back()}
              />
              <Button
                label="지금 맞추기"
                onPress={() => {
                  // 안내도 방금 답한 상황의 추천으로 한다 (주행 중 앱이 종료돼 고른 상황이 사라졌어도).
                  dispatch(driveContextSelected(context));
                  router.replace({
                    pathname: "/bodyfit/[profileId]/guide",
                    params: { profileId: driver.id },
                  });
                }}
                accessibilityHint="시트 버튼을 움직이면 화면이 축별로 알려 드려요"
              />
            </>
          ) : (
            <Button label="돌아가기" onPress={() => router.back()} />
          )
        }
      >
        {answered === "adjusted" ? (
          <Card title="고른 방향">
            <View style={styles.choices}>
              {TOUCH_FEEDBACK_CHOICES.filter(({ id }) =>
                selected.includes(id),
              ).map(({ id, label }) => (
                <View key={id} style={styles.picked}>
                  <AppText variant="bodyStrong">✓ {label}</AppText>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      title={COMFORT_SCREEN_QUESTION}
      description={
        context === DEFAULT_DRIVE_CONTEXT
          ? `${driver.name}님, 바꾸고 싶은 곳을 고르면 다음 추천에 반영해요`
          : `${driver.name}님, 바꾸고 싶은 곳을 고르면 다음 ${DRIVE_CONTEXT_LABEL[context]} 추천에 반영해요`
      }
      footer={
        <>
          <Button
            label="편했어요"
            variant="secondary"
            onPress={() => submit([])}
            disabled={!canAnswer || record.isPending}
            accessibilityHint="지금 자세를 편한 자세로 기억해요"
          />
          <Button
            label="반영하기"
            onPress={() => submit(selected)}
            disabled={!canAnswer || selected.length === 0}
            loading={record.isPending}
            accessibilityHint="시트는 움직이지 않고 다음 추천에만 반영해요"
          />
        </>
      }
    >
      {!vehicleConnected ? (
        <StatusView
          title="차량에 연결되어 있지 않아요"
          description="Pleos Connect 에뮬레이터나 차량에서 열면 답할 수 있어요"
        />
      ) : gear !== null && !parked ? (
        <StatusView
          title="주차 중에만 답할 수 있어요"
          description="차를 세우고 기어를 P로 바꾸면 이어서 물어볼게요"
        />
      ) : (
        <Columns
          left={
            <Card>
              <BodyfitSeatImage />
              <AppText variant="caption" tone="tertiary" style={styles.center}>
                시트는 움직이지 않아요. 고른 방향은 다음 추천에만 반영돼요
              </AppText>
            </Card>
          }
          right={
            <Card title="바꾸고 싶은 곳">
              <View style={styles.grid}>
                {TOUCH_FEEDBACK_CHOICES.map(({ id, label }) => (
                  <View key={id} style={styles.cell}>
                    <ToggleChip
                      shape="tile"
                      glyph={CHOICE_GLYPH[id]}
                      label={label}
                      checked={selected.includes(id)}
                      onPress={() =>
                        setSelected((current) => toggleTouchChoice(current, id))
                      }
                    />
                  </View>
                ))}
              </View>
            </Card>
          }
        />
      )}
      {record.error ? (
        <StatusView {...describeBodyfitError(record.error)} />
      ) : null}
    </Screen>
  );
}

const useStyles = themedStyles((colors) => ({
  skeleton: {
    height: 320,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  // 터치 대상 사이는 최소 24dp
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  // 넓은 카드에서는 두 줄 격자, 좁으면 한 줄에 하나씩 놓인다.
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  cell: { flexGrow: 1, flexBasis: "40%", minWidth: 280 },
  center: { textAlign: "center" },
  picked: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
}));
