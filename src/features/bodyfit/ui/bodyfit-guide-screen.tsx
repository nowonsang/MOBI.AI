import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { useAppSelector } from "@/core/store/hooks";
import { isPleosAvailable } from "@/shared/pleos/pleos";
import { useGear } from "@/shared/pleos/use-gear";
import { useUxRestrictions } from "@/shared/pleos/use-ux-restrictions";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { StatusView } from "@/shared/ui/status-view";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { canDemoSeat } from "../api/bodyfit.auto-adjust";
import { useRecordSeatAdjustment } from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { useLiveDriverSeat } from "../api/bodyfit.seat-live";
import { speakQuietly } from "../api/bodyfit.voice";
import { recommendationForVehicle } from "../model/bodyfit-axis-group";
import { pressDemoSeat, startDemoSeat } from "../model/bodyfit-demo-seat";
import {
  GUIDE_TOLERANCE,
  guideSeat,
  type AxisGuide,
} from "../model/bodyfit-guide";
import { learnOffsets, learnRemembered } from "../model/bodyfit-learning";
import { recommendSeat } from "../model/bodyfit-recommend";
import { toSeatRatios } from "../model/bodyfit-seat";
import { selectDriveContext } from "../model/bodyfit-session.slice";
import type { SeatAxis, SeatRatios } from "../model/bodyfit.types";
import { AXIS_COPY } from "./bodyfit-axis-copy";
import { describeBodyfitError } from "./bodyfit-error-copy";
import { BodyfitSeatPicture, type SeatMark } from "./bodyfit-seat-picture";
import { BodyfitStepList, type BodyfitStep } from "./bodyfit-step-list";
import { BodyfitMissingDriver } from "./bodyfit-missing-driver";

type DemoSeat = { start: SeatRatios; seat: SeatRatios };

const percent = (ratio: number) => Math.round(ratio * 100);

function describeAxis({ axis, status, direction, far }: AxisGuide): string {
  if (status === "ok" || direction === null) return "딱 좋아요";
  const action = AXIS_COPY[axis].guide[direction];
  if (status === "overshot") return `지나쳤어요. 조금 ${action}`;
  return far ? `더 ${action}` : `조금 더 ${action}`;
}

/**
 * B-5 가이드 조절: 운전자가 시트 버튼을 직접 누르는 동안 실시간 위치를 읽어 축별로 안내한다.
 * 시트를 움직이는 쪽은 운전자이므로 시트 제어 권한 없이 동작한다.
 */
export function BodyfitGuideScreen({ profileId }: { profileId: string }) {
  const styles = useStyles();
  const vehicleConnected = isPleosAvailable();
  const profile = useQuery(bodyfitQueries.profile(profileId));
  const adjustments = useQuery(bodyfitQueries.adjustments(profileId));
  const seat = useLiveDriverSeat({ enabled: vehicleConnected });
  const gear = useGear();
  const restrictions = useUxRestrictions();
  const record = useRecordSeatAdjustment();
  // 맞춤 자세 화면에서 고른 상황의 추천으로 안내하고, 기억하는 자세도 그 상황의 기록으로 남긴다 (C-5).
  const context = useAppSelector(selectDriveContext);
  const [notice, setNotice] = useState<string | null>(null);
  // 시연 모드: 에뮬레이터가 시트 위치를 0 으로만 돌려줄 때 화면 버튼으로 움직이는 모의 위치 (한 화면 안의 상태).
  const [demo, setDemo] = useState<DemoSeat | null>(null);

  const vehicleSeat = seat.data ? toSeatRatios(seat.data) : null;
  const current = demo ? demo.seat : vehicleSeat;
  // 안내를 시작한 자세. 목표를 지나쳤는지 판단하는 기준이라 처음 읽은 값을 한 번만 남긴다 (차량 값 복사가 아니다).
  const [start, setStart] = useState<SeatRatios | null>(null);
  if (start === null && vehicleSeat !== null) setStart(vehicleSeat);

  const recommended =
    profile.data && adjustments.data
      ? recommendSeat(
          profile.data,
          learnOffsets(adjustments.data, context),
          learnRemembered(adjustments.data, context),
        )
      : null;
  const guide =
    recommended && current
      ? guideSeat(current, recommended, demo ? demo.start : start)
      : null;
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
    return <BodyfitMissingDriver />;
  }

  const driver = profile.data;
  // 주차 중에만 안내한다: 주행 중 시트 조작을 부추기지 않는다 (S-5).
  const parked = gear === "park" && !restrictions.noSetup;

  const rememberCurrent = () =>
    record.mutate(
      { profile: driver, source: "saved", context },
      {
        onSuccess: () =>
          setNotice("지금 자세를 기억했어요. 다음 추천에 반영할게요"),
      },
    );

  const startDemo = () => {
    if (!recommended) return;
    // 실제 안내와 같은 축으로 시연한다: 차량이 알려 주지 않는 축(좌판 길이·헤드레스트·안전벨트)은 넣지 않는다.
    const demoStart = startDemoSeat(
      recommendationForVehicle(recommended, vehicleSeat),
    );
    setNotice(null);
    setDemo({ start: demoStart, seat: demoStart });
  };

  const press = (axis: SeatAxis, direction: "increase" | "decrease") =>
    setDemo((prev) =>
      prev
        ? { ...prev, seat: pressDemoSeat(prev.seat, axis, direction) }
        : prev,
    );

  // 시연 모드의 모의 위치는 학습 기록에 남기지 않는다 (기억하기 버튼을 두지 않는다).
  const footer = demo ? (
    <Button
      label="시연 끝내기"
      variant="secondary"
      onPress={() => setDemo(null)}
    />
  ) : (
    <>
      {canDemoSeat ? (
        <Button
          label="시연 모드로 보기"
          variant="secondary"
          onPress={startDemo}
          disabled={!recommended}
          accessibilityHint="화면 버튼으로 시트를 움직이는 것처럼 안내를 보여 줘요. 기록에는 남지 않아요"
        />
      ) : null}
      <Button
        label="지금 자세 기억하기"
        variant={done ? "primary" : "secondary"}
        onPress={rememberCurrent}
        disabled={!vehicleConnected || !seat.data}
        loading={record.isPending}
        accessibilityHint="목표와 달라도 지금 앉은 자세를 다음 추천에 반영해요"
      />
    </>
  );

  const body = (() => {
    if (!demo && !vehicleConnected) {
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
    if (!demo && seat.isError) {
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
    if (!guide || (!demo && gear === null)) {
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
    const steps: BodyfitStep[] = guide.axes.map((axis, index) => {
      const label = AXIS_COPY[axis.axis].label;
      const value = describeAxis(axis);
      return {
        axis: axis.axis,
        step: index + 1,
        label,
        value,
        detail: `지금 ${percent(axis.current)}% · 목표 ${percent(axis.target)}%`,
        accessibilityLabel: `${label}, ${value}, 지금 ${percent(axis.current)}퍼센트, 목표 ${percent(axis.target)}퍼센트`,
        state:
          axis.status === "ok"
            ? "done"
            : axis.axis === guide.focus
              ? "active"
              : "todo",
      };
    });
    const headline = focus ? describeAxis(focus) : "추천 자세에 다 맞췄어요";
    const marks: SeatMark[] = guide.axes.map((axis) => {
      const label = AXIS_COPY[axis.axis].label;
      if (axis.status === "ok")
        return { axis: axis.axis, text: `✓ ${label}`, tone: "done" };
      const text = axis.direction
        ? AXIS_COPY[axis.axis].stage[axis.direction]
        : label;
      return {
        axis: axis.axis,
        text,
        tone: axis.axis === guide.focus ? "active" : "todo",
      };
    });
    return (
      <View style={styles.body}>
        {/* 지금 할 일 하나만 크게 보여 준다 (이 화면의 강조는 여기 한 곳). */}
        <View
          style={[styles.focus, done && styles.focusDone]}
          accessibilityLiveRegion="polite"
        >
          <View style={styles.focusHead}>
            <AppText
              variant="secondary"
              tone="inverse"
              style={styles.focusLabel}
            >
              {focus ? `지금 맞출 곳 · ${AXIS_COPY[focus.axis].label}` : "완료"}
            </AppText>
          </View>
          {/* 낱말 단위로 줄을 바꾼다 (한 글자만 다음 줄로 넘어가지 않게). */}
          <View
            style={styles.focusWords}
            accessible
            accessibilityLabel={headline}
          >
            {headline.split(" ").map((word, index) => (
              <AppText
                key={`${index}-${word}`}
                variant="display"
                tone="inverse"
              >
                {word}
              </AppText>
            ))}
          </View>
          {focus ? (
            // 실시간 막대: 흰 점이 지금 위치, 밝은 띠가 목표 구간(맞춘 것으로 보는 범위).
            <View style={styles.gauge} accessible={false}>
              <View style={styles.gaugeTrack}>
                <View
                  style={[
                    styles.gaugeZone,
                    {
                      left: `${percent(Math.max(0, focus.target - GUIDE_TOLERANCE))}%`,
                      width: `${percent(GUIDE_TOLERANCE * 2)}%`,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.gaugeDot,
                    { left: `${percent(focus.current)}%` },
                  ]}
                />
              </View>
              <View style={styles.gaugeLabels}>
                <AppText variant="caption" tone="inverse">
                  {`지금 ${percent(focus.current)}%`}
                </AppText>
                <AppText variant="caption" tone="inverse">
                  {`목표 ${percent(focus.target)}%`}
                </AppText>
              </View>
            </View>
          ) : null}
          {focus && demo ? (
            <View style={styles.press}>
              {(["decrease", "increase"] as const).map((direction) => (
                <Button
                  key={direction}
                  label={AXIS_COPY[focus.axis].press[direction]}
                  variant="secondary"
                  onPress={() => press(focus.axis, direction)}
                  accessibilityHint={`${AXIS_COPY[focus.axis].label}를 시트 버튼처럼 한 번 움직여요`}
                />
              ))}
            </View>
          ) : null}
          {done ? (
            <AppText variant="secondary" tone="inverse">
              {demo
                ? "시연 모드라 이 자세는 기록하지 않아요"
                : "이 자세를 기억해 두면 다음 추천에 써요"}
            </AppText>
          ) : null}
        </View>
        <Card>
          {/* 자세 탭과 같은 그림: 지금 맞출 곳만 파랗게, 맞춘 곳은 초록 ✓, 남은 곳은 회색. */}
          <BodyfitSeatPicture
            marks={marks}
            accessibilityLabel={steps
              .map((step) => `${step.label} ${step.value}`)
              .join(", ")}
            // 좁은 창에서는 그림 양옆에 라벨 자리가 없어 순서 목록으로 보여 준다.
            fallback={
              <BodyfitStepList
                steps={steps}
                doneNoun="맞춘 곳"
                todoNoun="남은 곳"
              />
            }
          />
        </Card>
      </View>
    );
  })();

  return (
    <Screen
      title="시트 버튼으로 맞춰 주세요"
      description={
        demo
          ? "시연 모드예요. 화면 버튼이 시트 버튼 대신 움직여요"
          : "운전석 옆 시트 버튼을 움직이면 화면에 바로 보여요"
      }
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

const GAUGE_TRACK = 12;
const GAUGE_DOT = 32;

const useStyles = themedStyles((colors) => ({
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
  focusHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  focusLabel: { flex: 1 },
  focusWords: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.sm,
  },
  gauge: { gap: spacing.xs, paddingTop: spacing.xs },
  gaugeTrack: {
    height: GAUGE_TRACK,
    marginHorizontal: GAUGE_DOT / 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryStrong,
  },
  gaugeZone: {
    position: "absolute",
    top: 0,
    height: GAUGE_TRACK,
    borderRadius: radius.pill,
    backgroundColor: colors.onPrimary,
    opacity: 0.6,
  },
  gaugeDot: {
    position: "absolute",
    top: (GAUGE_TRACK - GAUGE_DOT) / 2,
    width: GAUGE_DOT,
    height: GAUGE_DOT,
    marginLeft: -GAUGE_DOT / 2,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: colors.primaryStrong,
    backgroundColor: colors.onPrimary,
  },
  gaugeLabels: { flexDirection: "row", justifyContent: "space-between" },
  body: { gap: spacing.md },
  press: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
}));
