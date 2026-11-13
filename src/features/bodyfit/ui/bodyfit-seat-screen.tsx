import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { useAppDispatch, useAppSelector } from "@/core/store/hooks";
import {
  canControlSeat,
  canUseCamera,
  canUseVoice,
  isDemoBuild,
} from "@/shared/config/app-variant";
import { isPleosAvailable } from "@/shared/pleos/pleos";
import { useGear } from "@/shared/pleos/use-gear";
import { useUxRestrictions } from "@/shared/pleos/use-ux-restrictions";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { ChipGroup } from "@/shared/ui/chip";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Columns } from "@/shared/ui/columns";
import { Divider } from "@/shared/ui/divider";
import { InfoRow } from "@/shared/ui/info-row";
import { Screen } from "@/shared/ui/screen";
import { SegmentedTabs } from "@/shared/ui/segmented-tabs";
import { StatusView } from "@/shared/ui/status-view";
import { radius, sizes, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { useAutoAdjust } from "../api/bodyfit.auto-adjust";
import { useStopSeat } from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { canTransferProfile } from "../api/bodyfit.transfer";
import { speakQuietly } from "../api/bodyfit.voice";
import {
  DEFAULT_DRIVE_CONTEXT,
  DRIVE_CONTEXT_LABEL,
  DRIVE_CONTEXTS,
} from "../model/bodyfit-drive-context";
import {
  describeDriveSuggestion,
  suggestDriveContext,
} from "../model/bodyfit-drive-suggestion";
import {
  explainOffsets,
  learningBasis,
  learnOffsets,
  learnRemembered,
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
import { BodyfitAutoAdjustProgress } from "./bodyfit-auto-adjust-progress";
import { describeBodyfitError } from "./bodyfit-error-copy";
import { BodyfitPostureLink } from "./bodyfit-posture-link";
import { BodyfitSeatStage } from "./bodyfit-seat-stage";
import { BodyfitVoiceFeedback } from "./bodyfit-voice-feedback";
import { BodyfitMissingDriver } from "./bodyfit-missing-driver";
import {
  DEMO_SEAT_MOVE_CONFIRM,
  SEAT_MOVE_CONFIRM,
} from "./bodyfit-confirm-copy";

const SOURCE_COPY: Record<SeatAdjustmentSource, string> = {
  "drive-start": "출발할 때 자세",
  saved: "직접 기억한 자세",
  touch: "주행 후 고른 자세",
  voice: "말로 고친 자세",
  camera: "카메라로 본 자세",
  imported: "다른 차에서 가져온 자세",
};

const RECENT_RECORDS = 3;

// 탭 카드는 한 번에 한 갈래만 보여 준다. 자세·온도·기록을 한 줄로 쌓으면 스크롤이 너무 길어진다.
type HubTab = "posture" | "comfort" | "records";

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
    // 반영한 기록 수는 이 줄 한 곳에서만 알린다.
    return basis.usedCount > 0
      ? `기록 ${basis.usedCount}건 반영 · 상황마다 그때 앉던 자세로 추천해요`
      : "첫 추천 · 상황마다 그때 앉던 자세로 추천해요";
  }
  const label = DRIVE_CONTEXT_LABEL[context];
  if (basis.kind === "all") {
    return basis.usedCount > 0
      ? `${label} 기록이 없어 전체 기록으로 추천해요`
      : `${label} 기록이 아직 없어요. 다음 출발부터 남겨요`;
  }
  return basis.kind === "mixed"
    ? `${label} 기록 ${basis.contextCount}건과 전체 기록으로 추천해요`
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
  const adjustments = useQuery(bodyfitQueries.adjustments(profileId));
  const seat = useQuery({
    ...bodyfitQueries.seat(),
    enabled: vehicleConnected,
  });
  const gear = useGear();
  const restrictions = useUxRestrictions();
  const auto = useAutoAdjust({
    parked: gear === "park" && !restrictions.noSetup,
  });
  // C-5: 주차 중이고 아직 상황을 고르지 않았을 때만 내비 경로를 읽어 상황을 제안한다. 읽지 못하면 제안 없이 지나간다.
  const naviRoute = useQuery({
    ...bodyfitQueries.naviRoute(),
    enabled:
      vehicleConnected &&
      gear === "park" &&
      !restrictions.noSetup &&
      context === DEFAULT_DRIVE_CONTEXT,
  });
  const stop = useStopSeat();
  const [confirming, setConfirming] = useState<"move" | null>(null);
  // 어느 탭을 보고 있는지는 이 화면 안에서만 쓰는 상태다 (화면을 다시 열면 자세부터).
  const [tab, setTab] = useState<HubTab>("posture");

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
    return <BodyfitMissingDriver />;
  }

  const driver = profile.data;
  const recommended = recommendSeat(
    driver,
    learnOffsets(adjustments.data, context),
    learnRemembered(adjustments.data, context),
  );
  const current = seat.data ? toSeatRatios(seat.data) : null;
  // 시트 조절은 플랫폼 제한(CarUxRestrictions NO_SETUP)이 없고 기어가 P 일 때만 연다.
  // 네이티브도 움직이기 전과 도중에 기어 P 를 다시 확인한다 (DriverSeat.kt).
  const parked = gear === "park" && !restrictions.noSetup;
  // C-5: 고른 상황의 기록이 충분하면 그 기록만, 아니면 전체 기록을 반영한다.
  const basis = learningBasis(adjustments.data, context);
  // C-4: 기록이 추천을 눈에 띄게 바꿨으면 무엇 때문인지 알려 준다.
  const reason = explainOffsets(adjustments.data, context);
  const recentRecords = [...adjustments.data]
    .sort((a, b) => b.at - a.at)
    .slice(0, RECENT_RECORDS);
  const suggestion = parked
    ? suggestDriveContext(naviRoute.data, context)
    : null;

  // 시연 모드로 움직인 뒤에는 모의 위치를 "지금" 자세로 보여 준다 (기록·음성 조절은 차량 값만 쓴다).
  const shown = auto.demoSeat ?? current;

  // 운전자가 확인 창에서 "맞추기"를 누른 뒤에만 움직인다 (secure-coding 1장).
  const applyRecommendation = () => {
    setConfirming(null);
    auto.start(recommended, shown);
  };

  // B-5 가이드 조절: 운전자가 시트 버튼으로 맞추고 화면이 안내한다. 시트 제어 권한이 없는 market 빌드의 주 경로다.
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

  // 주행 자세 관찰: 출발 자세 기억 → 주행 중 변화 리포트 → 지난번과 비교.
  const openPosture = () =>
    router.push({
      pathname: "/bodyfit/[profileId]/posture",
      params: { profileId: driver.id },
    });

  // A-7: 다른 차로 가져갈 QR 코드 화면
  const openExport = () =>
    router.push({
      pathname: "/bodyfit/[profileId]/export",
      params: { profileId: driver.id },
    });

  const error = seat.error;
  // 주행 자세 관찰을 켠 운전자는 주차 중 카메라가 켜져 있고, 주행 중에도 관찰한다 (C-7).
  const observing = canUseCamera && vehicleConnected && driver.postureConsent;
  const status = !vehicleConnected
    ? { label: "차량에 연결되어 있지 않아요", dot: styles.dotIdle }
    : parked
      ? { label: "P · 주차 중이에요", dot: styles.dotParked }
      : { label: "주행 중에는 시트를 맞추지 않아요", dot: styles.dotBlocked };

  // B-4·B-7: 자동 조절이 움직이는 동안과 끝난 직후에는 진행 화면만 보여 준다 (누를 수 있는 것은 멈추기뿐).
  if (auto.run) {
    return (
      <BodyfitAutoAdjustProgress
        run={auto.run}
        demoSeat={auto.demoSeat}
        onStop={auto.stop}
        onDone={() => void speakQuietly("추천 자세로 맞췄어요")}
        onClose={auto.dismiss}
      />
    );
  }

  const moveConfirm = auto.demo ? DEMO_SEAT_MOVE_CONFIRM : SEAT_MOVE_CONFIRM;

  // 기어 상태는 제목 오른쪽에 둔다. 시트를 움직일 수 있는지가 이 화면에서 가장 먼저 봐야 할 정보다.
  // 상태는 점 색과 글자로 함께 알린다. 누를 수 없는 표시라 면·그림자 없이 글자만 둔다 (버튼으로 보이지 않게).
  // 주행 자세 관찰(카메라)을 켜 둔 운전자는 카메라가 켜지는 기능이 있다는 것을 같은 줄에 늘 보이게 둔다.
  const statusLine = (
    <View
      style={styles.status}
      accessible
      accessibilityLabel={
        observing ? `${status.label}, 자세 관찰 중` : status.label
      }
      accessibilityLiveRegion="polite"
    >
      <View style={styles.statusItem}>
        <View style={[styles.dot, status.dot]} />
        <AppText variant="secondary" style={styles.statusText}>
          {status.label}
        </AppText>
      </View>
      {observing ? (
        <View style={styles.statusItem}>
          <View style={[styles.dot, styles.dotObserving]} />
          <AppText variant="secondary" style={styles.statusText}>
            자세 관찰 중
          </AppText>
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen
      title={`${driver.name} 님`}
      // 반영한 기록 수는 왼쪽 카드 제목 옆 한 곳에서만 알린다. 설명 줄은 기록이 추천을 바꾼 이유가 있을 때만 쓴다.
      description={reason ?? undefined}
      // 운전자는 뒤로 가기(운전자 목록)로 바꾼다. 같은 일을 하는 버튼을 제목 옆에 또 두지 않는다.
      aside={statusLine}
      // 제목·탭·왼쪽 요약은 자리를 지키고 탭 내용만 스크롤한다 (목록을 내려도 다른 탭으로 갈 수 있게).
      pinned
      // 하단 버튼은 시트를 맞추는 자세 탭에만 둔다 (온도 탭은 카드 안 버튼, 기록 탭은 없음).
      // 시트가 움직이는 동안에는 어느 탭에서든 멈추기를 보여 준다.
      footer={
        tab === "posture" ? (
          <>
            <Button
              label="안내 받으며 맞추기"
              // 자동 조절을 쓰는 빌드(contest)에서는 보조 버튼으로 내린다.
              variant={canControlSeat ? "secondary" : "primary"}
              onPress={openGuide}
              disabled={!vehicleConnected || auto.seatMoving}
              accessibilityHint="시트 버튼을 움직이면 화면에 축별로 보여 줘요"
            />
            {!canControlSeat ? null : auto.seatMoving ? (
              // 음성 조절처럼 자동 조절 밖에서 시작한 이동도 여기서 멈출 수 있다.
              <Button label="멈추기" onPress={() => stop.mutate()} />
            ) : (
              // B-4 자동 조절: 시트 제어를 쓰는 빌드(contest)의 주 버튼. 확인 창을 거친 뒤에만 움직인다.
              <Button
                label="자동으로 맞추기"
                onPress={() => setConfirming("move")}
                disabled={!vehicleConnected || !parked}
                accessibilityHint="기어가 P 일 때만 시트가 움직여요"
              />
            )}
          </>
        ) : canControlSeat && auto.seatMoving ? (
          <Button label="멈추기" onPress={() => stop.mutate()} />
        ) : undefined
      }
    >
      <ConfirmDialog
        visible={confirming === "move"}
        title={moveConfirm.title}
        description={moveConfirm.description}
        confirmLabel="맞추기"
        onConfirm={applyRecommendation}
        onCancel={() => setConfirming(null)}
      />
      {/* 운전 상황은 모든 탭의 추천에 걸리므로 탭 카드 위 한 줄에 둔다. 주행 중에는 고르지 않는다 (S-5). */}
      {vehicleConnected ? (
        <View style={styles.context}>
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
            style={styles.contextText}
          >
            {parked
              ? describeContextBasis(context, basis)
              : `운전 상황 · ${DRIVE_CONTEXT_LABEL[context]} (주차 중에만 바꿀 수 있어요)`}
          </AppText>
          {suggestion ? (
            // 제안만 한다. 운전자가 눌러야 상황이 바뀐다.
            <View style={styles.suggestion}>
              <AppText
                variant="caption"
                tone="secondary"
                accessibilityLiveRegion="polite"
              >
                {describeDriveSuggestion(suggestion)}
              </AppText>
              <Button
                label={`${DRIVE_CONTEXT_LABEL[suggestion.context]} 자세로 보기`}
                variant="secondary"
                onPress={() =>
                  dispatch(driveContextSelected(suggestion.context))
                }
                accessibilityHint="내비게이션 경로에 맞는 상황으로 추천을 바꿔요"
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {/* 그림 하나가 핵심인 화면이라 2단으로 나누지 않고 탭 카드 한 장을 폭 전체로 쓴다 (ui-design 1장). */}
      <Columns
        pinned
        rightPanel
        rightHeader={
          <SegmentedTabs
            label="시트 화면 보기"
            options={[
              { value: "posture", label: "자세" },
              { value: "comfort", label: "온도·무드등" },
              {
                value: "records",
                label: "기록",
              },
            ]}
            selected={tab}
            onSelect={setTab}
          />
        }
        right={
          <>
            {tab === "posture" ? (
              <>
                <BodyfitSeatStage
                  recommended={recommended}
                  current={shown}
                  aside={
                    auto.canDemo && canControlSeat && vehicleConnected ? (
                      // 자동 조절 시연 모드: 에뮬레이터는 시트 위치가 바뀌지 않아 모의 위치로 흐름을 보여 준다.
                      // 시연할 때만 쓰므로 그림 아래 줄의 조용한 글자 버튼으로 둔다.
                      <Pressable
                        accessibilityRole="switch"
                        accessibilityState={{ checked: auto.demo }}
                        accessibilityHint={
                          auto.demo
                            ? "화면에서만 움직여요. 기록은 남지 않아요"
                            : "시트는 그대로 두고 화면으로만 보여 줘요"
                        }
                        onPress={auto.toggleDemo}
                        style={({ pressed }) => [
                          styles.quiet,
                          pressed && styles.quietPressed,
                        ]}
                      >
                        <AppText
                          variant="secondary"
                          tone={auto.demo ? "accent" : "tertiary"}
                          style={styles.strong}
                        >
                          {auto.demo ? "✓ 시연 모드" : "시연 모드"}
                        </AppText>
                      </Pressable>
                    ) : undefined
                  }
                />
                {!vehicleConnected ? (
                  <AppText variant="caption" tone="tertiary">
                    Pleos Connect 에뮬레이터나 차량에서 열면 시트를 맞출 수
                    있어요
                  </AppText>
                ) : null}

                {/* 주행 자세 관찰을 켠 운전자: 마지막 주행 결과를 자세 탭에서 바로 본다 (기록 탭까지 내려가지 않게). */}
                {observing ? (
                  <BodyfitPostureLink
                    driver={driver}
                    afterDrive={false}
                    postureAt={null}
                    compact
                  />
                ) : null}

                {error ? <StatusView {...describeBodyfitError(error)} /> : null}

                {vehicleConnected && canUseVoice && driver.voiceConsent ? (
                  <BodyfitVoiceFeedback
                    profile={driver}
                    seat={seat.data}
                    parked={parked}
                  />
                ) : null}
              </>
            ) : null}

            {tab === "comfort" ? (
              <BodyfitComfortCard
                profileId={driver.id}
                vehicleConnected={vehicleConnected}
                parked={parked}
              />
            ) : null}

            {tab === "records" ? (
              <>
                <Card
                  title="최근 기록"
                  count={
                    adjustments.data.length > RECENT_RECORDS
                      ? `전체 ${adjustments.data.length}건 중 ${RECENT_RECORDS}건`
                      : `${adjustments.data.length}건`
                  }
                >
                  {recentRecords.length === 0 ? (
                    <AppText variant="secondary" tone="secondary">
                      아직 기록이 없어요. 출발하면 자세가 기록돼요
                    </AppText>
                  ) : (
                    <View style={styles.records}>
                      {recentRecords.map((record) => (
                        // 한 줄: 무엇이 남았는지는 왼쪽, 언제(어떤 상황)인지는 오른쪽 끝
                        <InfoRow
                          key={`${record.at}-${record.source}`}
                          value={SOURCE_COPY[record.source]}
                          trailing={
                            <AppText variant="secondary" tone="tertiary">
                              {record.context === DEFAULT_DRIVE_CONTEXT
                                ? formatDay(record.at)
                                : `${formatDay(record.at)} · ${DRIVE_CONTEXT_LABEL[record.context]}`}
                            </AppText>
                          }
                        />
                      ))}
                    </View>
                  )}
                </Card>
                {/* 기록으로 이어지는 화면들. 카드마다 띄우면 무거워 한 카드 안 행으로 묶는다.
                    시트가 움직이는 동안에는 멈추기 버튼이 사라지지 않게 화면을 떠나지 않는다. */}
                <Card>
                  {/* D-2: 주행 후 질문. 화면 제목과 같은 말로 부른다 */}
                  <InfoRow
                    value="오늘 운전 자세는 편하셨나요?"
                    onPress={auto.seatMoving ? undefined : openFeedback}
                  />
                  {/* 주행 중 카메라 관찰이 연결되기 전에는 예시 기록뿐이라 시연용 빌드에서만 연다.
                      관찰을 켠 운전자는 자세 탭의 리포트 카드로 같은 화면에 가므로 여기서는 뺀다. */}
                  {isDemoBuild && !observing ? (
                    <>
                      <Divider />
                      <InfoRow
                        value="주행 자세 관찰"
                        onPress={auto.seatMoving ? undefined : openPosture}
                      />
                    </>
                  ) : null}
                  {/* A-7: 체형과 학습한 보정을 QR 코드로 보여 준다. 누르기 전에는 코드를 그리지 않는다 */}
                  {canTransferProfile ? (
                    <>
                      <Divider />
                      <InfoRow
                        value="다른 차로 가져가기"
                        onPress={auto.seatMoving ? undefined : openExport}
                      />
                    </>
                  ) : null}
                </Card>
              </>
            ) : null}
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
  // 제목 오른쪽 기어 상태 (점 + 글자). 누를 수 없는 표시라 터치 크기는 필요 없지만 버튼과 높이를 맞춘다.
  status: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    // 줄바꿈이 있는 줄은 기본이 위쪽 정렬이라 옆 버튼과 높이 가운데를 맞춘다
    alignContent: "center",
    columnGap: spacing.md,
    minHeight: sizes.touchTarget,
  },
  statusItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusText: { fontWeight: "700" },
  dot: { width: 16, height: 16, borderRadius: radius.pill },
  dotParked: { backgroundColor: colors.success },
  dotObserving: { backgroundColor: colors.primary },
  dotBlocked: { backgroundColor: colors.warning },
  dotIdle: { backgroundColor: colors.inkDisabled },
  strong: { fontWeight: "700" },
  // 칩과 설명을 한 줄에 두고, 넘치면 다음 줄로 (세로 공간을 탭 카드에 남긴다).
  context: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  contextText: { flexShrink: 1 },
  suggestion: { alignItems: "flex-start", gap: spacing.xs },
  records: { gap: spacing.xs },
  quiet: {
    minHeight: sizes.touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control,
  },
  quietPressed: { backgroundColor: colors.surfaceMuted },
}));
