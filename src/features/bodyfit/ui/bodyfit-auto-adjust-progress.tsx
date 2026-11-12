import { useEffect, useEffectEvent } from "react";
import { View, useWindowDimensions } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Columns } from "@/shared/ui/columns";
import { Screen } from "@/shared/ui/screen";
import { radius, shadows, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { useLiveDriverSeat } from "../api/bodyfit.seat-live";
import {
  countAdjusted,
  viewAutoAdjust,
  type AutoAdjustAxis,
  type AutoAdjustRun,
} from "../model/bodyfit-auto-adjust";
import { toSeatRatios } from "../model/bodyfit-seat";
import type { SeatAxis, SeatRatios } from "../model/bodyfit.types";
import { describeBodyfitError } from "./bodyfit-error-copy";
import { BodyfitSeatImage } from "./bodyfit-seat-image";
import { BodyfitStepList, type BodyfitStep } from "./bodyfit-step-list";

const AXIS_COPY: Record<
  SeatAxis,
  { label: string; increase: string; decrease: string }
> = {
  foreAft: {
    label: "앞뒤 위치",
    increase: "앞으로 움직이는 중",
    decrease: "뒤로 움직이는 중",
  },
  height: { label: "높이", increase: "올리는 중", decrease: "내리는 중" },
  backrest: { label: "등받이", increase: "세우는 중", decrease: "눕히는 중" },
  tilt: {
    label: "좌판 기울기",
    increase: "앞쪽을 올리는 중",
    decrease: "앞쪽을 내리는 중",
  },
  depth: { label: "좌판 길이", increase: "늘리는 중", decrease: "줄이는 중" },
  headrestHeight: {
    label: "헤드레스트 높이",
    increase: "올리는 중",
    decrease: "내리는 중",
  },
  beltHeight: {
    label: "안전벨트 높이",
    increase: "올리는 중",
    decrease: "내리는 중",
  },
  lumbar: {
    label: "허리 지지대",
    increase: "내미는 중",
    decrease: "넣는 중",
  },
  headrestAngle: {
    label: "헤드레스트 각도",
    increase: "앞으로 세우는 중",
    decrease: "뒤로 젖히는 중",
  },
};

const percent = (ratio: number) => Math.round(ratio * 100);

function describeAxis(axis: AutoAdjustAxis, finished: boolean): string {
  switch (axis.status) {
    case "done":
      return "맞췄어요";
    case "moving":
      return axis.direction
        ? AXIS_COPY[axis.axis][axis.direction]
        : "확인하는 중";
    case "stopped":
      return "여기서 멈췄어요";
    case "failed":
      return "끝까지 가지 못했어요";
    case "waiting":
      return finished ? "움직이지 않았어요" : "기다리는 중";
  }
}

type Headline = { title: string; description: string; step: string };

function describeRun(run: AutoAdjustRun, axes: AutoAdjustAxis[]): Headline {
  const total = run.steps.length;
  const adjusted = countAdjusted(run);
  const count = `${total}곳 중 ${adjusted}곳을 맞췄어요`;
  switch (run.outcome) {
    case "done":
      return {
        title: "추천 자세로 맞췄어요",
        description: "불편한 곳이 있으면 언제든 다시 맞출 수 있어요",
        step: `${total}곳을 모두 맞췄어요 ✓`,
      };
    case "stopped":
      return {
        title: "시트를 멈췄어요",
        description: "이어서 맞추려면 '자동으로 맞추기'를 다시 눌러 주세요",
        step: count,
      };
    case "failed": {
      // 같은 실패는 다른 화면과 같은 문구로 알린다 (bodyfit-error-copy.ts).
      const error = describeBodyfitError({ code: run.errorCode });
      return {
        title: error.title,
        description: error.description,
        step: total > 0 ? count : "시트를 움직이지 않았어요",
      };
    }
    case null: {
      const active = axes.find((axis) => axis.status === "moving");
      return {
        title: "시트를 맞추고 있어요",
        description: "움직이는 동안 언제든 멈출 수 있어요",
        step: run.stopping
          ? "멈추는 중이에요"
          : active
            ? `${describeAxis(active, false)}이에요`
            : "시트 위치를 확인하고 있어요",
      };
    }
  }
}

type BodyfitAutoAdjustProgressProps = {
  run: AutoAdjustRun;
  /** 시연 모드의 모의 시트 위치. 실제 이동에서는 차량의 위치 알림을 쓴다 */
  demoSeat: SeatRatios | null;
  onStop: () => void;
  /** 모든 축을 맞췄을 때 한 번 불린다 (음성 안내 등) */
  onDone?: () => void;
  /** 끝난 뒤 맞춤 자세 화면으로 돌아간다 */
  onClose: () => void;
};

/**
 * B-4·B-7 자동 조절 진행 화면: 어느 축이 움직이는 중이고 어느 축이 끝났는지 보여 준다.
 * 움직이는 동안 누를 수 있는 것은 멈추기 하나뿐이다 (뒤로 가기도 두지 않는다).
 * 시연 모드에서도 같은 화면을 쓰되 시연 모드임을 계속 표시한다.
 */
export function BodyfitAutoAdjustProgress({
  run,
  demoSeat,
  onStop,
  onDone,
  onClose,
}: BodyfitAutoAdjustProgressProps) {
  const styles = useStyles();
  // 진행 문구와 멈추기가 한 화면에 함께 보이게 운전석 그림은 남는 높이만큼만 쓴다 (낮은 창에서는 뺀다).
  const windowHeight = useWindowDimensions().height;
  const pictureHeight =
    windowHeight >= 1000 ? 240 : windowHeight >= 820 ? 150 : 0;
  // 실제 이동: 시트가 움직이는 동안 오는 위치 알림으로 "지금" 값을 따라간다.
  const seat = useLiveDriverSeat({ enabled: !run.demo });
  const current = run.demo
    ? demoSeat
    : seat.data
      ? toSeatRatios(seat.data)
      : null;
  const axes = viewAutoAdjust(run, current);
  const moving = run.outcome === null;
  const done = run.outcome === "done";
  const headline = describeRun(run, axes);
  const active = axes.find((axis) => axis.status === "moving");

  const announceDone = useEffectEvent(() => onDone?.());
  useEffect(() => {
    if (done) announceDone();
  }, [done]);

  const summary = (
    <>
      <Card>
        {run.demo ? (
          <View style={styles.demo}>
            <AppText variant="caption" tone="secondary">
              시연 모드 · 실제 시트는 움직이지 않아요
            </AppText>
          </View>
        ) : null}
        <View style={styles.now} accessibilityLiveRegion="polite">
          <AppText variant="secondary" tone="tertiary">
            {active
              ? `지금 움직이는 곳 · ${AXIS_COPY[active.axis].label}`
              : moving
                ? "자동 조절"
                : "결과"}
          </AppText>
          <AppText variant="display">{headline.step}</AppText>
        </View>
        {axes.length > 0 ? (
          <View style={styles.count}>
            <AppText variant="caption" tone="secondary">
              {countAdjusted(run)}/{axes.length} 맞춤
            </AppText>
          </View>
        ) : null}
      </Card>
      {pictureHeight > 0 ? (
        <View style={styles.stage}>
          <BodyfitSeatImage height={pictureHeight} />
        </View>
      ) : null}
    </>
  );

  const stepItems: BodyfitStep[] = axes.map((axis, index) => {
    const text = describeAxis(axis, !moving);
    const label = AXIS_COPY[axis.axis].label;
    return {
      axis: axis.axis,
      step: index + 1,
      label,
      value: text,
      detail: `지금 ${percent(axis.current)}% · 목표 ${percent(axis.target)}%`,
      accessibilityLabel: `${label}, ${text}, 지금 ${percent(axis.current)}퍼센트, 목표 ${percent(axis.target)}퍼센트`,
      state:
        axis.status === "done"
          ? "done"
          : axis.status === "moving"
            ? "active"
            : axis.status === "waiting"
              ? "todo"
              : "issue",
      track: { current: axis.current, target: axis.target },
    };
  });

  // 움직일 축을 받기 전에는 스켈레톤을 보여 준다. 축 없이 끝났으면(자동 조절을 지원하지 않는 차량) 목록을 그리지 않는다.
  // 축이 많아도 멈추기와 함께 한 화면에 들어오게 지금 움직이는 곳만 펼치고 나머지는 접는다.
  const steps =
    axes.length === 0 && !moving ? null : (
      <Card title="움직이는 순서">
        {axes.length === 0 ? (
          <View style={styles.skeleton} accessibilityLabel="불러오는 중" />
        ) : (
          <BodyfitStepList
            steps={stepItems}
            doneNoun="맞춘 곳"
            todoNoun={moving ? "남은 곳" : "움직이지 않은 곳"}
          />
        )}
      </Card>
    );

  return (
    <Screen
      back={false}
      title={headline.title}
      description={headline.description}
      footer={
        // 멈추기는 화면 폭을 다 써서 이 화면에서 가장 크게 보이게 한다.
        <View style={styles.action}>
          {moving ? (
            <Button
              label="멈추기"
              onPress={onStop}
              accessibilityHint="시트를 바로 멈춰요"
            />
          ) : (
            <Button label="확인" onPress={onClose} />
          )}
        </View>
      }
    >
      {steps ? <Columns left={summary} right={steps} /> : summary}
    </Screen>
  );
}

const useStyles = themedStyles((colors) => ({
  // 넓은 창에서는 하단 줄을 다 채우고, 좁은 창에서는 Screen 이 폭에 맞춘다.
  action: { flexGrow: 1 },
  // 시연 모드 표시는 색과 글자로 함께 알린다.
  demo: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.warning,
    backgroundColor: colors.surface,
  },
  now: { gap: spacing.xs },
  count: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  skeleton: {
    height: 320,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  // 그림은 꾸밈용이라 카드 제목·여백 없이 낮게 둔다.
  stage: {
    alignItems: "center",
    padding: spacing.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
}));
