import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { isPleosAvailable } from "@/shared/pleos/pleos";
import { useGear } from "@/shared/pleos/use-gear";
import { useUxRestrictions } from "@/shared/pleos/use-ux-restrictions";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Columns } from "@/shared/ui/columns";
import { IconBadge } from "@/shared/ui/icon-badge";
import { InfoRow } from "@/shared/ui/info-row";
import { Screen } from "@/shared/ui/screen";
import { StatusView } from "@/shared/ui/status-view";
import { colors, radius, spacing } from "@/shared/ui/theme";

import { useRecordSeatAdjustment } from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { useLiveDriverSeat } from "../api/bodyfit.seat-live";
import { speakQuietly } from "../api/bodyfit.voice";
import { guideSeat, type AxisGuide } from "../model/bodyfit-guide";
import { learnOffsets } from "../model/bodyfit-learning";
import { recommendSeat } from "../model/bodyfit-recommend";
import { toSeatRatios } from "../model/bodyfit-seat";
import type { SeatAxis, SeatRatios } from "../model/bodyfit.types";
import { describeBodyfitError } from "./bodyfit-error-copy";
import { BodyfitSeatImage } from "./bodyfit-seat-image";

const AXIS_COPY: Record<
  SeatAxis,
  { label: string; increase: string; decrease: string }
> = {
  foreAft: {
    label: "앞뒤 위치",
    increase: "앞으로 당겨 주세요",
    decrease: "뒤로 밀어 주세요",
  },
  height: { label: "높이", increase: "올려 주세요", decrease: "내려 주세요" },
  backrest: {
    label: "등받이",
    increase: "세워 주세요",
    decrease: "눕혀 주세요",
  },
  tilt: {
    label: "좌판 기울기",
    increase: "앞쪽을 올려 주세요",
    decrease: "앞쪽을 내려 주세요",
  },
};

const percent = (ratio: number) => Math.round(ratio * 100);

function describeAxis({ axis, status, direction, far }: AxisGuide): string {
  if (status === "ok" || direction === null) return "딱 좋아요";
  const action = AXIS_COPY[axis][direction];
  if (status === "overshot") return `지나쳤어요. 조금 ${action}`;
  return far ? `더 ${action}` : `조금 더 ${action}`;
}

/**
 * B-5 가이드 조절: 운전자가 시트 버튼을 직접 누르는 동안 실시간 위치를 읽어 축별로 안내한다.
 * 시트를 움직이는 쪽은 운전자이므로 시트 제어 권한 없이 동작한다.
 */
export function BodyfitGuideScreen({ profileId }: { profileId: string }) {
  const router = useRouter();
  const vehicleConnected = isPleosAvailable();
  const profile = useQuery(bodyfitQueries.profile(profileId));
  const adjustments = useQuery(bodyfitQueries.adjustments(profileId));
  const seat = useLiveDriverSeat({ enabled: vehicleConnected });
  const gear = useGear();
  const restrictions = useUxRestrictions();
  const record = useRecordSeatAdjustment();
  const [notice, setNotice] = useState<string | null>(null);

  const current = seat.data ? toSeatRatios(seat.data) : null;
  // 안내를 시작한 자세. 목표를 지나쳤는지 판단하는 기준이라 처음 읽은 값을 한 번만 남긴다 (차량 값 복사가 아니다).
  const [start, setStart] = useState<SeatRatios | null>(null);
  if (start === null && current !== null) setStart(current);

  const recommended =
    profile.data && adjustments.data
      ? recommendSeat(profile.data, learnOffsets(adjustments.data))
      : null;
  const guide =
    recommended && current ? guideSeat(current, recommended, start) : null;
  const done = guide?.done ?? false;

  useEffect(() => {
    if (done) void speakQuietly("추천 자세에 다 맞췄어요");
  }, [done]);

  if (profile.isPending || adjustments.isPending) {
    return (
      <Screen title="안내를 준비하고 있어요">
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
  // 주차 중에만 안내한다: 주행 중 시트 조작을 부추기지 않는다 (S-5).
  const parked = gear === "park" && !restrictions.noSetup;

  const rememberCurrent = () =>
    record.mutate(
      { profile: driver, source: "saved" },
      {
        onSuccess: () =>
          setNotice("지금 자세를 기억했어요. 다음 추천에 반영할게요"),
      },
    );

  const footer = (
    <Button
      label="지금 자세 기억하기"
      variant={done ? "primary" : "secondary"}
      onPress={rememberCurrent}
      disabled={!vehicleConnected || !seat.data}
      loading={record.isPending}
      accessibilityHint="목표와 달라도 지금 앉은 자세를 다음 추천에 반영해요"
    />
  );

  const body = (() => {
    if (!vehicleConnected) {
      return (
        <StatusView
          title="차량에 연결되어 있지 않아요"
          description="Pleos Connect 에뮬레이터나 차량에서 열면 안내를 받을 수 있어요"
        />
      );
    }
    if (gear !== null && !parked) {
      return (
        <StatusView
          title="주차 중에만 안내해요"
          description="차를 세우고 기어를 P로 바꾸면 이어서 안내할게요"
        />
      );
    }
    if (seat.isError) {
      return (
        <StatusView
          {...describeBodyfitError(seat.error)}
          action={{
            label: "다시 불러오기",
            onPress: () => void seat.refetch(),
          }}
        />
      );
    }
    if (!guide || gear === null) {
      return <View style={styles.skeleton} accessibilityLabel="불러오는 중" />;
    }
    if (guide.axes.length === 0) {
      return (
        <StatusView
          title="이 차량은 시트 위치를 알려 주지 않아요"
          description="시트 버튼으로 편하게 맞춘 뒤 '지금 자세 기억하기'를 눌러 주세요"
        />
      );
    }

    const focus = guide.axes.find((axis) => axis.axis === guide.focus);
    const matched = guide.axes.filter((axis) => axis.status === "ok").length;
    return (
      <Columns
        left={
          <>
            {/* 지금 할 일 하나만 크게 보여 준다 (이 화면의 강조는 여기 한 곳). */}
            <View
              style={[styles.focus, done && styles.focusDone]}
              accessibilityLiveRegion="polite"
            >
              <AppText variant="secondary" tone="inverse">
                {focus
                  ? `지금 맞출 곳 · ${AXIS_COPY[focus.axis].label}`
                  : "완료"}
              </AppText>
              <AppText variant="display" tone="inverse">
                {focus ? describeAxis(focus) : "추천 자세에 다 맞췄어요 ✓"}
              </AppText>
              <View style={styles.progress}>
                <AppText
                  variant="caption"
                  style={done ? styles.progressDone : styles.progressText}
                >
                  {matched}/{guide.axes.length} 맞춤
                </AppText>
              </View>
              {done ? (
                <AppText variant="secondary" tone="inverse">
                  이 자세를 기억해 두면 다음 추천이 더 정확해져요
                </AppText>
              ) : null}
            </View>
            <Card>
              <BodyfitSeatImage />
            </Card>
          </>
        }
        right={
          <Card title="축별 안내">
            <View style={styles.list}>
              {guide.axes.map((axis, index) => {
                const active = axis.axis === guide.focus;
                return (
                  <View
                    key={axis.axis}
                    style={[styles.step, active && styles.stepActive]}
                  >
                    <InfoRow
                      icon={
                        <IconBadge
                          glyph={axis.status === "ok" ? "✓" : `${index + 1}`}
                          tone={
                            axis.status === "ok"
                              ? "success"
                              : active
                                ? "primary"
                                : "muted"
                          }
                        />
                      }
                      label={AXIS_COPY[axis.axis].label}
                      value={describeAxis(axis)}
                      detail={`지금 ${percent(axis.current)}% · 목표 ${percent(axis.target)}%`}
                      accessibilityLabel={`${AXIS_COPY[axis.axis].label}, ${describeAxis(axis)}, 지금 ${percent(axis.current)}퍼센트, 목표 ${percent(axis.target)}퍼센트`}
                    />
                  </View>
                );
              })}
            </View>
          </Card>
        }
      />
    );
  })();

  return (
    <Screen
      title="시트 버튼으로 맞춰 주세요"
      description="운전석 옆 시트 버튼을 움직이면 화면이 바로 알려 드려요"
     
      footer={footer}
    >
      {body}
      {notice ? (
        <AppText
          variant="secondary"
          tone="secondary"
          accessibilityLiveRegion="polite"
        >
          {notice}
        </AppText>
      ) : null}
      {record.error ? (
        <StatusView {...describeBodyfitError(record.error)} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    height: 320,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  focus: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.primary,
  },
  focusDone: { backgroundColor: colors.success },
  progress: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  progressText: { color: colors.primary, fontWeight: "700" },
  progressDone: { color: colors.success, fontWeight: "700" },
  list: { gap: spacing.xs },
  step: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.control,
  },
  // 지금 맞출 축은 옅은 파란 면과 번호 원 색으로 함께 표시한다.
  stepActive: { backgroundColor: colors.primaryTint },
});
