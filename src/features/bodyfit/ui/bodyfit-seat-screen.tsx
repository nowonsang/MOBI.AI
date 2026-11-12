import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { useAppDispatch, useAppSelector } from "@/core/store/hooks";
import { canControlSeat, canUseVoice } from "@/shared/config/app-variant";
import { isPleosAvailable } from "@/shared/pleos/pleos";
import { useGear } from "@/shared/pleos/use-gear";
import { useUxRestrictions } from "@/shared/pleos/use-ux-restrictions";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card, SummaryCard } from "@/shared/ui/card";
import { ChipGroup } from "@/shared/ui/chip";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Columns } from "@/shared/ui/columns";
import { IconBadge } from "@/shared/ui/icon-badge";
import { InfoRow } from "@/shared/ui/info-row";
import { Screen } from "@/shared/ui/screen";
import { StatusView } from "@/shared/ui/status-view";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import {
  useDeleteBodyProfile,
  useMoveSeat,
  useStopSeat,
} from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { speakQuietly } from "../api/bodyfit.voice";
import {
  DEFAULT_DRIVE_CONTEXT,
  DRIVE_CONTEXT_LABEL,
  DRIVE_CONTEXTS,
} from "../model/bodyfit-drive-context";
import { guideSeat } from "../model/bodyfit-guide";
import {
  explainOffsets,
  learningBasis,
  learnOffsets,
  type LearningBasis,
} from "../model/bodyfit-learning";
import { recommendSeat } from "../model/bodyfit-recommend";
import { toSeatRatios } from "../model/bodyfit-seat";
import {
  driveContextSelected,
  driverSelected,
  selectDriveContext,
} from "../model/bodyfit-session.slice";
import type {
  DriveContext,
  SeatAdjustmentSource,
} from "../model/bodyfit.types";
import { BodyfitComfortCard } from "./bodyfit-comfort-card";
import { describeBodyfitError } from "./bodyfit-error-copy";
import { BodyfitSeatAxes } from "./bodyfit-seat-axes";
import { BodyfitSeatImage } from "./bodyfit-seat-image";
import { BodyfitVoiceFeedback } from "./bodyfit-voice-feedback";

const MOVE_CONFIRM = {
  title: "시트를 움직일게요",
  description: "시트 주변에 물건이나 사람이 끼지 않았는지 확인해 주세요",
};

const SOURCE_COPY: Record<
  SeatAdjustmentSource,
  { glyph: string; label: string }
> = {
  "drive-start": { glyph: "→", label: "출발할 때 자세" },
  saved: { glyph: "✓", label: "직접 기억한 자세" },
  touch: { glyph: "↔", label: "주행 후 피드백" },
  voice: { glyph: "♪", label: "음성 피드백" },
};

const RECENT_RECORDS = 3;

const CONTEXT_OPTIONS = DRIVE_CONTEXTS.map((value) => ({
  value,
  label: DRIVE_CONTEXT_LABEL[value],
}));

// C-5: 고른 상황의 추천이 어떤 기록으로 만들어졌는지 한 줄로 알려 준다.
function describeContextBasis(
  context: DriveContext,
  basis: LearningBasis,
): string {
  if (context === DEFAULT_DRIVE_CONTEXT) {
    return "상황을 고르면 그 상황에서 앉던 자세로 추천해요";
  }
  const label = DRIVE_CONTEXT_LABEL[context];
  if (basis.kind === "all") {
    return basis.usedCount > 0
      ? `${label} 기록이 아직 없어 전체 기록으로 추천해요`
      : `${label} 기록이 아직 없어요. 출발할 때 자세부터 기억해요`;
  }
  return basis.kind === "mixed"
    ? `${label} 기록 ${basis.contextCount}건을 전체 기록과 함께 반영했어요`
    : `${label} 기록 ${basis.contextCount}건으로 추천해요`;
}

const formatDay = (at: number) => {
  const date = new Date(at);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

export function BodyfitSeatScreen({ profileId }: { profileId: string }) {
  const styles = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const context = useAppSelector(selectDriveContext);
  const vehicleConnected = isPleosAvailable();
  const profile = useQuery(bodyfitQueries.profile(profileId));
  const profiles = useQuery(bodyfitQueries.profiles());
  const adjustments = useQuery(bodyfitQueries.adjustments(profileId));
  const seat = useQuery({
    ...bodyfitQueries.seat(),
    enabled: vehicleConnected,
  });
  const gear = useGear();
  const restrictions = useUxRestrictions();
  const move = useMoveSeat();
  const stop = useStopSeat();
  const remove = useDeleteBodyProfile();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"move" | "delete" | null>(null);

  // 이 화면을 연 운전자를 이번 주행의 운전자로 본다 (주행 시작 자세·주행 후 질문에 쓴다).
  useEffect(() => {
    dispatch(driverSelected(profileId));
  }, [dispatch, profileId]);

  if (profile.isPending || adjustments.isPending) {
    return (
      <Screen title="자세를 계산하고 있어요">
        <View style={styles.skeleton} accessibilityLabel="불러오는 중" />
      </Screen>
    );
  }

  if (profile.isError || adjustments.isError || !profile.data) {
    return (
      <Screen title="운전자 정보를 찾지 못했어요">
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
  const recommended = recommendSeat(
    driver,
    learnOffsets(adjustments.data, context),
  );
  const current = seat.data ? toSeatRatios(seat.data) : null;
  // 시트 조절은 플랫폼 제한(CarUxRestrictions NO_SETUP)이 없고 기어가 P 일 때만 연다.
  // 네이티브도 움직이기 전과 도중에 기어 P 를 다시 확인한다 (DriverSeat.kt).
  const parked = gear === "park" && !restrictions.noSetup;
  // C-5: 고른 상황의 기록이 충분하면 그 기록만, 아니면 전체 기록을 반영한다.
  const basis = learningBasis(adjustments.data, context);
  const learnedCount = basis.usedCount;
  // C-4: 기록이 추천을 눈에 띄게 바꿨으면 무엇 때문인지 알려 준다.
  const reason = explainOffsets(adjustments.data, context);
  const recentRecords = [...adjustments.data]
    .sort((a, b) => b.at - a.at)
    .slice(0, RECENT_RECORDS);
  const drivers = profiles.data ?? [];

  // B-3 변경 미리보기를 한 줄로: 지금 자세에서 몇 곳을 움직여야 하는지.
  const guide = current ? guideSeat(current, recommended) : null;
  const toAdjust = guide
    ? guide.axes.filter((axis) => axis.status !== "ok").length
    : 0;
  const summary = !guide
    ? "체형으로 계산했어요"
    : guide.axes.length === 0
      ? "시트 위치를 읽을 수 없어요"
      : toAdjust === 0
        ? "지금 자세가 딱 좋아요"
        : `${guide.axes.length}곳 중 ${toAdjust}곳 조절`;

  // 운전자가 확인 창에서 "맞추기"를 누른 뒤에만 움직인다 (secure-coding 1장).
  const applyRecommendation = () => {
    setConfirming(null);
    move.mutate(recommended, {
      onSuccess: () => {
        setNotice("추천 자세로 맞췄어요");
        void speakQuietly(
          "추천 자세로 맞췄어요. 불편한 곳이 있으면 말로 알려 주세요",
        );
      },
    });
  };

  // 주 경로: 운전자가 시트 버튼으로 맞추고 화면이 안내한다 (시트 제어 SDK 가 Coming Soon 이라도 동작한다).
  const openGuide = () =>
    router.push({
      pathname: "/bodyfit/[profileId]/guide",
      params: { profileId: driver.id },
    });

  // D-2: 주행 후 질문 화면. 오래 달린 뒤에는 자동으로 뜨고, 여기서 직접 열 수도 있다.
  const openFeedback = () =>
    router.push({
      pathname: "/bodyfit/[profileId]/feedback",
      params: { profileId: driver.id },
    });

  const deleteDriver = () => {
    setConfirming(null);
    remove.mutate(driver.id, {
      onSuccess: () => router.replace("/bodyfit"),
    });
  };

  const error = move.error ?? seat.error;
  const status = !vehicleConnected
    ? { label: "차량에 연결되어 있지 않아요", style: styles.statusIdle }
    : parked
      ? { label: "P · 주차 중이에요", style: styles.statusParked }
      : {
          label: "주행 중에는 시트를 맞추지 않아요",
          style: styles.statusBlocked,
        };

  return (
    <Screen
      title={`${driver.name} 님`}
      description={
        reason ??
        (learnedCount > 0
          ? `체형과 지금까지의 자세 기록 ${learnedCount}건을 반영했어요`
          : "체형으로 계산한 첫 추천이에요. 쓰실수록 몸에 맞춰져요")
      }
      footer={
        <>
          {!canControlSeat ? null : move.isPending ? (
            <Button
              label="멈추기"
              variant="secondary"
              onPress={() => stop.mutate()}
            />
          ) : (
            // 확장 경로 (B-4): 시트 제어 권한이 열리면 쓰는 자동 조절.
            <Button
              label="자동으로 맞추기"
              variant="secondary"
              onPress={() => setConfirming("move")}
              disabled={!vehicleConnected || !parked}
              accessibilityHint="기어가 P 일 때만 시트가 움직여요"
            />
          )}
          <Button
            label="주행 후 피드백"
            variant="secondary"
            onPress={openFeedback}
            disabled={move.isPending}
            accessibilityHint="오늘 자세가 어땠는지 알려 주시면 다음 추천에 반영해요"
          />
          <Button
            label="안내 받으며 맞추기"
            onPress={openGuide}
            disabled={!vehicleConnected || move.isPending}
            accessibilityHint="시트 버튼을 움직이면 화면이 축별로 알려 드려요"
          />
        </>
      }
    >
      <ConfirmDialog
        visible={confirming === "move"}
        title={MOVE_CONFIRM.title}
        description={MOVE_CONFIRM.description}
        confirmLabel="맞추기"
        onConfirm={applyRecommendation}
        onCancel={() => setConfirming(null)}
      />
      <ConfirmDialog
        visible={confirming === "delete"}
        title={`${driver.name}님의 정보를 지울까요?`}
        description="체형 정보와 자세 기록이 모두 지워지고 되돌릴 수 없어요"
        confirmLabel="지우기"
        onConfirm={deleteDriver}
        onCancel={() => setConfirming(null)}
      />
      <Columns
        left={
          <>
            <SummaryCard
              label="추천 자세"
              value={summary}
              onPress={vehicleConnected ? openGuide : undefined}
              accessibilityHint="안내를 받으며 시트를 맞춰요"
            />
            <Card
              title="내 시트"
              count={
                learnedCount > 0 ? `기록 ${learnedCount}건 반영` : "첫 추천"
              }
            >
              {drivers.length > 1 ? (
                <ChipGroup
                  label="운전자 고르기"
                  options={drivers.map(({ id, name }) => ({
                    value: id,
                    label: name,
                  }))}
                  selected={driver.id}
                  onSelect={(id) => {
                    if (id === driver.id) return;
                    router.replace({
                      pathname: "/bodyfit/[profileId]",
                      params: { profileId: id },
                    });
                  }}
                />
              ) : null}
              {vehicleConnected ? (
                <View style={styles.context}>
                  {/* 상황은 주차(P) 중에만 고른다. 주행 중에는 조작을 요구하지 않는다 (S-5). */}
                  {parked ? (
                    <ChipGroup
                      label="운전 상황 고르기"
                      options={CONTEXT_OPTIONS}
                      selected={context}
                      onSelect={(next) => dispatch(driveContextSelected(next))}
                    />
                  ) : null}
                  <AppText
                    variant="caption"
                    tone="tertiary"
                    accessibilityLiveRegion="polite"
                  >
                    {parked
                      ? describeContextBasis(context, basis)
                      : `운전 상황 · ${DRIVE_CONTEXT_LABEL[context]} (주차 중에만 바꿀 수 있어요)`}
                  </AppText>
                </View>
              ) : null}
              <BodyfitSeatImage />
              <View
                style={[styles.status, status.style]}
                accessibilityLiveRegion="polite"
              >
                <AppText variant="caption" tone="secondary">
                  {status.label}
                </AppText>
              </View>
              {!vehicleConnected ? (
                <AppText
                  variant="caption"
                  tone="tertiary"
                  style={styles.center}
                >
                  Pleos Connect 에뮬레이터나 차량에서 열면 시트를 맞출 수 있어요
                </AppText>
              ) : null}
            </Card>
          </>
        }
        right={
          <>
            <Card title="축별 추천">
              <BodyfitSeatAxes recommended={recommended} current={current} />
            </Card>

            <BodyfitComfortCard
              profileId={driver.id}
              vehicleConnected={vehicleConnected}
              parked={parked}
            />

            {notice ? (
              <AppText
                variant="secondary"
                tone="secondary"
                accessibilityLiveRegion="polite"
              >
                {notice}
              </AppText>
            ) : null}
            {error ? <StatusView {...describeBodyfitError(error)} /> : null}

            {vehicleConnected && canUseVoice && driver.voiceConsent ? (
              <BodyfitVoiceFeedback
                profile={driver}
                seat={seat.data}
                parked={parked}
              />
            ) : null}

            <Card title="자세 기록" count={`${adjustments.data.length}건`}>
              {recentRecords.length === 0 ? (
                <AppText variant="secondary" tone="secondary">
                  아직 기록이 없어요. 출발할 때의 자세부터 자동으로 기억해요
                </AppText>
              ) : (
                <View style={styles.records}>
                  {recentRecords.map((record) => (
                    <InfoRow
                      key={`${record.at}-${record.source}`}
                      icon={
                        <IconBadge glyph={SOURCE_COPY[record.source].glyph} />
                      }
                      label={formatDay(record.at)}
                      value={SOURCE_COPY[record.source].label}
                      detail={
                        record.context === DEFAULT_DRIVE_CONTEXT
                          ? undefined
                          : DRIVE_CONTEXT_LABEL[record.context]
                      }
                    />
                  ))}
                </View>
              )}
              <View style={styles.manage}>
                <Button
                  label="운전자 정보 지우기"
                  variant="secondary"
                  onPress={() => setConfirming("delete")}
                  loading={remove.isPending}
                  accessibilityHint="체형 정보와 자세 기록을 모두 지워요"
                />
              </View>
            </Card>
          </>
        }
      />
    </Screen>
  );
}

const useStyles = themedStyles((colors) => ({
  skeleton: {
    height: 320,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  // 상태는 색과 글자로 함께 알린다.
  status: {
    alignSelf: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  statusParked: {
    borderColor: colors.success,
    backgroundColor: colors.surface,
  },
  statusBlocked: {
    borderColor: colors.warning,
    backgroundColor: colors.surface,
  },
  statusIdle: { borderColor: colors.fill, backgroundColor: colors.fill },
  center: { textAlign: "center" },
  context: { gap: spacing.xs },
  records: { gap: spacing.xs },
  manage: { alignItems: "flex-start" },
}));
