import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View, useWindowDimensions } from "react-native";

import { isPleosAvailable } from "@/shared/pleos/pleos";
import { useGear } from "@/shared/pleos/use-gear";
import { useUxRestrictions } from "@/shared/pleos/use-ux-restrictions";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card, SummaryCard } from "@/shared/ui/card";
import { Columns } from "@/shared/ui/columns";
import { IconBadge } from "@/shared/ui/icon-badge";
import { InfoRow } from "@/shared/ui/info-row";
import { Screen } from "@/shared/ui/screen";
import { StatusView } from "@/shared/ui/status-view";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import {
  useMarkPostureDriveApplied,
  useRecordSeatAdjustment,
} from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import {
  comparePostureDrives,
  latestPostureDrive,
  suggestForPosture,
  summarizePostureDrive,
} from "../model/bodyfit-posture";
import { describeBodyfitError } from "./bodyfit-error-copy";
import {
  comparisonHeadline,
  comparisonLead,
  comparisonShort,
  datedDrivePhrase,
  formatMinutes,
  nextDrivePhrase,
  nudgeApplied,
  nudgeQuestion,
  postureChangeTiles,
  postureHeadline,
  thisDrivePhrase,
} from "./bodyfit-posture-copy";
import {
  BodyfitPostureImage,
  BodyfitPostureImageLegend,
} from "./bodyfit-posture-image";
import { BodyfitPostureSampleNotice } from "./bodyfit-posture-sample-notice";
import {
  BodyfitPostureTimeline,
  BodyfitPostureTimelineLegend,
} from "./bodyfit-posture-timeline";

const TITLE = "주행 자세 리포트";

/**
 * 도착해서 P단: 출발 자세와 견줘 주행 중 달라진 점을 보여 주고, 다음 주행을 위한 조절을 제안한다.
 * [반영하기]는 시트를 움직이지 않는다. "지금 자세 + 제안 방향"을 기록에 남겨 다음 추천을 보정한다
 * (주행 후 터치 피드백과 같은 길: useRecordSeatAdjustment).
 */
export function BodyfitPostureReportScreen({
  profileId,
  startedAt,
}: {
  profileId: string;
  /** 지난 기록을 따로 열 때 그 주행의 출발 시각. 없으면 가장 최근 주행이다 */
  startedAt: number | null;
}) {
  const styles = useStyles();
  const router = useRouter();
  const vehicleConnected = isPleosAvailable();
  const profile = useQuery(bodyfitQueries.profile(profileId));
  const drives = useQuery(bodyfitQueries.postureDrives(profileId));
  const gear = useGear();
  const restrictions = useUxRestrictions();
  const record = useRecordSeatAdjustment();
  const markApplied = useMarkPostureDriveApplied();
  const [applied, setApplied] = useState(false);
  const windowHeight = useWindowDimensions().height;

  if (profile.isPending || drives.isPending) {
    return (
      <Screen title={TITLE}>
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
  const all = drives.data ?? [];
  const latest = latestPostureDrive(all);
  const drive =
    startedAt === null
      ? latest
      : (all.find((item) => item.startedAt === startedAt) ?? null);

  if (drives.isError || !drive) {
    return (
      <Screen title={TITLE} width="narrow">
        <StatusView
          title="아직 지켜본 주행이 없어요"
          description="주행 자세 관찰을 켜 두고 한 번 주행하면, 주차했을 때 여기에서 알려 드려요"
          action={{ label: "돌아가기", onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const report = summarizePostureDrive(drive);
  const drifted = report.driftStartMin !== null;
  const isLatest = drive === latest;
  const driveName = isLatest
    ? thisDrivePhrase(drive.context)
    : datedDrivePhrase(drive.startedAt, drive.context);
  // 제안은 가장 최근 주행에만 한다: 반영은 "지금 시트 자세"를 기준으로 남기기 때문이다.
  const nudge = isLatest ? suggestForPosture(report) : null;
  // 이미 반영한 주행은 다시 반영하지 않는다 (나갔다 다시 열어도 같은 주행이 두 번 학습되지 않게).
  const alreadyApplied = drive.appliedAt != null;
  const offer = nudge !== null && !alreadyApplied;
  const comparison = isLatest ? comparePostureDrives(all, drive.context) : null;
  // 한 화면에 들어오게 그림은 창 높이에 맞춰 줄인다 (변화량은 옆의 숫자가 전한다).
  // 아래에 "지난번과 비교" 줄이 붙으면 그만큼 더 줄인다.
  const pictureHeight =
    windowHeight >= 1000 ? (comparison ? 220 : 300) : comparison ? 180 : 220;
  // 주차 중에만 반영한다: 주행 중 화면 조작을 요구하지 않는다 (S-5).
  const parked = gear === "park" && !restrictions.noSetup;
  const canApply = vehicleConnected && parked;

  if (applied && nudge) {
    return (
      <Screen
        title="다음 추천에 반영했어요"
        description={`시트는 그대로예요. ${nudgeApplied(nudge, drive.context)}`}
        width="narrow"
        footer={<Button label="돌아가기" onPress={() => router.back()} />}
      >
        <Card>
          <InfoRow
            icon={<IconBadge glyph="✓" tone="success" />}
            label={`${nextDrivePhrase(drive.context)} 다시 지켜볼게요`}
            value="출발 자세를 더 오래 유지했는지 알려 드려요"
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      title={TITLE}
      description={`${driver.name}님, ${driveName} ${formatMinutes(report.durationMin)} 동안 지켜본 자세예요`}
      footer={
        offer ? (
          <>
            <Button
              label="이번엔 괜찮아요"
              variant="secondary"
              onPress={() => router.back()}
              disabled={record.isPending}
            />
            <Button
              label="반영하기"
              onPress={() =>
                record.mutate(
                  {
                    profile: driver,
                    // 카메라로 본 실제 기록이면 출처를 "카메라로 본 자세"로 남긴다 (예시 기록은 터치와 같게).
                    source: drive.sample ? "touch" : "camera",
                    context: drive.context,
                    nudges: [nudge],
                  },
                  {
                    onSuccess: () => {
                      setApplied(true);
                      markApplied.mutate({
                        profileId: driver.id,
                        startedAt: drive.startedAt,
                      });
                    },
                  },
                )
              }
              disabled={!canApply}
              loading={record.isPending}
              accessibilityHint="시트는 움직이지 않고 다음 추천에만 반영해요"
            />
          </>
        ) : (
          <Button label="돌아가기" onPress={() => router.back()} />
        )
      }
    >
      {drive.sample ? <BodyfitPostureSampleNotice /> : null}
      {/* 두 줄로 나눠 왼쪽·오른쪽 카드의 위아래 끝을 맞춘다: 1줄 = 요약·그림 | 자세 변화, 2줄 = 지난번 비교 | 제안 */}
      <Columns
        stretch
        left={
          <>
            <SummaryCard
              stacked
              label={driveName}
              value={postureHeadline(report)}
            />
            <Card fill>
              <BodyfitPostureImage
                pose={drifted ? "drift" : "upright"}
                height={pictureHeight}
                label={
                  drifted
                    ? "출발 때보다 머리와 등이 앞으로 나온 자세 그림"
                    : "출발 자세 그대로인 그림"
                }
              />
              {drifted ? <BodyfitPostureImageLegend /> : null}
            </Card>
          </>
        }
        right={
          <>
            <Card
              fill
              title="주행 중 자세 변화"
              count={formatMinutes(report.durationMin)}
            >
              <BodyfitPostureTimeline
                heldMin={report.heldMin}
                driftMin={report.driftMin}
                marker
                axis
              />
              <BodyfitPostureTimelineLegend />
              {drifted ? (
                <View style={styles.tiles}>
                  {postureChangeTiles(report.change).map((tile) => (
                    <View
                      key={tile.key}
                      style={styles.tile}
                      accessible
                      accessibilityLabel={`${tile.label}, ${tile.value}`}
                    >
                      <AppText variant="caption" tone="tertiary">
                        {tile.label}
                      </AppText>
                      <AppText
                        variant="bodyStrong"
                        tone={tile.changed ? "default" : "tertiary"}
                      >
                        {tile.value}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          </>
        }
      />
      {comparison || nudge ? (
        <Columns
          stretch
          left={
            <>
              {comparison ? (
                <Card fill>
                  <InfoRow
                    icon={<IconBadge glyph="⇄" />}
                    label={comparisonLead(comparison)}
                    value={comparisonShort(comparison)}
                    onPress={() =>
                      router.push({
                        pathname: "/bodyfit/[profileId]/posture/compare",
                        params: {
                          profileId: driver.id,
                          context: drive.context,
                        },
                      })
                    }
                    accessibilityLabel={`지난번과 비교. ${comparisonLead(comparison)} ${comparisonHeadline(comparison)}`}
                  />
                </Card>
              ) : null}
            </>
          }
          right={
            <>
              {nudge ? (
                <Card fill>
                  {alreadyApplied ? (
                    // 반영한 뒤에는 묻지 않고 반영한 내용을 완료 표시로 보여 준다.
                    <InfoRow
                      icon={<IconBadge glyph="✓" tone="success" />}
                      label="다음 추천에 반영했어요"
                      value={nudgeApplied(nudge, drive.context)}
                    />
                  ) : (
                    <InfoRow
                      icon={<IconBadge glyph="↑" tone="tint" />}
                      label={nextDrivePhrase(drive.context)}
                      value={nudgeQuestion(nudge)}
                      detail={
                        !vehicleConnected
                          ? "Pleos Connect 에뮬레이터나 차량에서 열면 반영할 수 있어요"
                          : gear !== null && !parked
                            ? "차를 세우고 기어를 P로 바꾸면 반영할 수 있어요"
                            : "반영해도 지금은 시트가 움직이지 않아요. 다음 추천에만 써요"
                      }
                    />
                  )}
                </Card>
              ) : null}
            </>
          }
        />
      ) : null}
      {record.error ? (
        <StatusView {...describeBodyfitError(record.error)} />
      ) : null}
    </Screen>
  );
}

const useStyles = themedStyles((colors) => ({
  skeleton: {
    height: 360,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  skeletonTall: {
    height: 520,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  // 넓으면 세 칸이 나란히, 좁으면 아래로 내려간다.
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: "28%",
    minWidth: 180,
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
}));
