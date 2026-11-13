import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View } from "react-native";

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

import { bodyfitQueries } from "../api/bodyfit.queries";
import {
  comparePostureDrives,
  latestPostureDrive,
  suggestRestMin,
} from "../model/bodyfit-posture";
import type { DriveContext } from "../model/bodyfit.types";
import {
  comparisonHeadline,
  comparisonLead,
  formatMinutes,
  lastDrivePhrase,
  thisDrivePhrase,
} from "./bodyfit-posture-copy";
import { BodyfitPostureSampleNotice } from "./bodyfit-posture-sample-notice";
import {
  BodyfitPostureTimeline,
  BodyfitPostureTimelineLegend,
} from "./bodyfit-posture-timeline";
import { BodyfitMissingDriver } from "./bodyfit-missing-driver";

const TITLE = "지난번과 비교";

/**
 * 다음 장거리: 반영한 자세로 달린 뒤, 출발 자세를 지난번보다 오래 유지했는지 보여 준다.
 * 같은 상황의 최근 두 주행을 같은 시간 눈금 위에 나란히 놓는다.
 */
export function BodyfitPostureCompareScreen({
  profileId,
  context,
}: {
  profileId: string;
  /** 견줄 운전 상황. 없으면 가장 최근 주행의 상황이다 */
  context: DriveContext | null;
}) {
  const styles = useStyles();
  const router = useRouter();
  const profile = useQuery(bodyfitQueries.profile(profileId));
  const drives = useQuery(bodyfitQueries.postureDrives(profileId));

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
    return <BodyfitMissingDriver />;
  }

  const driver = profile.data;
  const all = drives.data ?? [];
  const latest = latestPostureDrive(all, context ?? undefined);
  const comparison = latest ? comparePostureDrives(all, latest.context) : null;

  if (!latest || !comparison) {
    return (
      <Screen title={TITLE} width="narrow">
        <StatusView
          title="아직 비교할 주행이 없어요"
          description="같은 상황으로 두 번 달리면 비교할 수 있어요"
          action={{ label: "돌아가기", onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const { previous, current } = comparison;
  const last = lastDrivePhrase(comparison.context);
  const now = thisDrivePhrase(comparison.context);
  const restMin = suggestRestMin(current);
  // 견준 두 주행 중 지난 쪽. 그 주행의 리포트를 따로 열 수 있게 한다.
  const before = all
    .filter(
      (item) =>
        item.context === comparison.context &&
        item.startedAt < latest.startedAt,
    )
    .sort((a, b) => b.startedAt - a.startedAt)[0];

  return (
    <Screen
      title={TITLE}
      description="최근 두 번 주행에서 출발 자세를 유지한 시간이에요"
      footer={
        before ? (
          <Button
            label="지난 리포트 보기"
            onPress={() =>
              router.push({
                pathname: "/bodyfit/[profileId]/posture/report",
                params: {
                  profileId: driver.id,
                  startedAt: String(before.startedAt),
                },
              })
            }
          />
        ) : undefined
      }
    >
      {latest.sample ? <BodyfitPostureSampleNotice /> : null}
      <Columns
        stretch
        left={
          <>
            <SummaryCard
              stacked
              label={comparisonLead(comparison)}
              value={comparisonHeadline(comparison)}
            />
            <Card fill title="출발 자세 유지">
              <View style={styles.stats}>
                <View
                  style={styles.stat}
                  accessible
                  accessibilityLabel={`${last}, ${formatMinutes(previous.heldMin)}`}
                >
                  <AppText variant="caption" tone="tertiary">
                    {last}
                  </AppText>
                  <AppText variant="heading" tone="secondary">
                    {formatMinutes(previous.heldMin)}
                  </AppText>
                </View>
                <View
                  style={styles.stat}
                  accessible
                  accessibilityLabel={`${now}, ${formatMinutes(current.heldMin)}`}
                >
                  <AppText variant="caption" tone="tertiary">
                    {now}
                  </AppText>
                  <AppText variant="heading">
                    {formatMinutes(current.heldMin)}
                  </AppText>
                </View>
              </View>
            </Card>
          </>
        }
        right={
          <>
            <Card title="자세를 유지한 시간" count="같은 시간 눈금">
              <View style={styles.row}>
                <AppText variant="caption" tone="secondary">
                  {last} · {formatMinutes(previous.durationMin)}
                </AppText>
                <BodyfitPostureTimeline
                  heldMin={previous.heldMin}
                  driftMin={previous.driftMin}
                  scaleMin={comparison.scaleMin}
                />
              </View>
              <View style={styles.row}>
                <AppText variant="caption" tone="secondary">
                  {now} · {formatMinutes(current.durationMin)}
                </AppText>
                <BodyfitPostureTimeline
                  heldMin={current.heldMin}
                  driftMin={current.driftMin}
                  scaleMin={comparison.scaleMin}
                  previousDriftStartMin={previous.driftStartMin}
                />
              </View>
              <BodyfitPostureTimelineLegend
                previousDriftStartMin={previous.driftStartMin}
              />
            </Card>
            <Card fill>
              {current.driftStartMin === null ? (
                <InfoRow
                  icon={<IconBadge glyph="✓" tone="success" />}
                  label={now}
                  value="끝까지 출발 자세를 유지했어요"
                />
              ) : (
                <InfoRow
                  icon={<IconBadge glyph="!" tone="warning" />}
                  label={now}
                  value={`${formatMinutes(current.driftStartMin)}쯤부터 다시 자세가 앞으로 쏠렸어요`}
                  detail={
                    restMin === null
                      ? undefined
                      : `다음에는 ${formatMinutes(restMin)}쯤에 쉬어 가면 좋아요`
                  }
                />
              )}
            </Card>
          </>
        }
      />
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
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: "40%",
    minWidth: 180,
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  row: { gap: spacing.xs },
}));
