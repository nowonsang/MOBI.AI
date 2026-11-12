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
import { IconBadge } from "@/shared/ui/icon-badge";
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
import type { DriveContext, SeatAxis } from "../model/bodyfit.types";
import { AXIS_COPY } from "./bodyfit-axis-copy";
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

// 선택지를 축별로 한 줄씩 묶는다 (한 축에는 한 방향만 고를 수 있다: toggleTouchChoice).
// 줄 안의 순서는 화면 방향과 맞춘다: 뒤로 ← → 앞으로, 낮추기 ▼ ▲ 높이기.
const CHOICE_ROWS: readonly {
  axis: SeatAxis;
  ids: readonly [TouchFeedbackChoiceId, TouchFeedbackChoiceId];
}[] = [
  { axis: "backrest", ids: ["backrest-increase", "backrest-decrease"] },
  { axis: "foreAft", ids: ["foreAft-decrease", "foreAft-increase"] },
  { axis: "height", ids: ["height-decrease", "height-increase"] },
];

const choiceLabel = (id: TouchFeedbackChoiceId) =>
  TOUCH_FEEDBACK_CHOICES.find((choice) => choice.id === id)?.label ?? "";

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
        {/* 실제 화면과 같은 2단 모양의 스켈레톤 */}
        <Columns
          left={
            <View style={styles.skeleton} accessibilityLabel="불러오는 중" />
          }
          right={<View style={styles.skeletonTall} />}
        />
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
          ? `${driver.name}님, 바꾸고 싶은 곳만 골라 주세요. 다음 추천에 반영해요`
          : `${driver.name}님, 바꾸고 싶은 곳만 골라 주세요. 다음 ${DRIVE_CONTEXT_LABEL[context]} 추천에 반영해요`
      }
      footer={
        selected.length === 0 ? (
          // 고른 곳이 없으면 "편했어요" 한 번으로 답이 끝난다.
          <Button
            label="편했어요"
            onPress={() => submit([])}
            disabled={!canAnswer}
            loading={record.isPending}
            accessibilityHint="지금 자세를 편한 자세로 기억해요"
          />
        ) : (
          <>
            <Button
              label="다시 고르기"
              variant="secondary"
              onPress={() => setSelected([])}
              disabled={record.isPending}
              accessibilityHint="고른 방향을 모두 지워요"
            />
            <Button
              label={`${selected.length}곳 반영하기`}
              onPress={() => submit(selected)}
              disabled={!canAnswer}
              loading={record.isPending}
              accessibilityHint="시트는 움직이지 않고 다음 추천에만 반영해요"
            />
          </>
        )
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
              {context !== DEFAULT_DRIVE_CONTEXT ? (
                <View style={styles.contextTag}>
                  <AppText variant="caption">
                    {DRIVE_CONTEXT_LABEL[context]} 기록으로 남겨요
                  </AppText>
                </View>
              ) : null}
              <View style={styles.stage}>
                <BodyfitSeatImage height={280} />
              </View>
              <AppText
                variant="secondary"
                tone="secondary"
                style={styles.center}
              >
                시트는 움직이지 않아요
              </AppText>
            </Card>
          }
          right={
            <Card title="바꾸고 싶은 곳" count="한 줄에 하나">
              <View style={styles.rows}>
                {CHOICE_ROWS.map(({ axis, ids }, index) => (
                  <View
                    key={axis}
                    style={[styles.row, index > 0 && styles.rowDivider]}
                  >
                    {/* 축 이름 + 반대 방향 두 개를 한 줄에. 좁으면 아래로 내려간다 */}
                    <View style={styles.axis}>
                      <IconBadge glyph={AXIS_COPY[axis].glyph} tone="muted" />
                      <AppText variant="bodyStrong">
                        {AXIS_COPY[axis].label}
                      </AppText>
                    </View>
                    <View style={styles.pair}>
                      {ids.map((id) => (
                        <View key={id} style={styles.cell}>
                          <ToggleChip
                            shape="tile"
                            glyph={CHOICE_GLYPH[id]}
                            label={choiceLabel(id)}
                            checked={selected.includes(id)}
                            onPress={() =>
                              setSelected((current) =>
                                toggleTouchChoice(current, id),
                              )
                            }
                          />
                        </View>
                      ))}
                    </View>
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
  skeletonTall: {
    height: 480,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  // 터치 대상 사이는 최소 24dp
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  // 축마다 한 줄: 축 이름 아래에 반대 방향 두 개를 나란히 둔다.
  rows: { gap: spacing.md },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
  },
  axis: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minWidth: 260,
  },
  rowDivider: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  // 넓으면 두 개를 나란히, 좁으면 한 줄에 하나씩 놓인다.
  pair: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    minWidth: 400,
  },
  cell: { flexGrow: 1, flexBasis: "40%", minWidth: 180 },
  stage: {
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  center: { textAlign: "center" },
  // 어느 상황의 기록으로 남는지 알려 주는 표시 (옅은 파랑 면 + ink 글자: theme.test 의 검사 조합)
  contextTag: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  picked: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
}));
