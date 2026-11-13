import { Fragment, useState, type ReactNode } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { radius, sizes, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { guideSeat, type AxisGuide } from "../model/bodyfit-guide";
import type { SeatAxis, SeatRatios } from "../model/bodyfit.types";
import { AXIS_COPY } from "./bodyfit-axis-copy";
import { BodyfitSeatAxes, BodyfitSeatAxesLegend } from "./bodyfit-seat-axes";
import { BodyfitSeatImage } from "./bodyfit-seat-image";

type BodyfitSeatStageProps = {
  recommended: SeatRatios;
  /** 차량에서 읽은 현재 자세(시연 모드에서는 모의 위치). 차량이 없으면 null */
  current: SeatRatios | null;
  /** 아래 줄 오른쪽, "숫자로 보기" 앞에 둘 조용한 버튼 (예: 시연 모드) */
  aside?: ReactNode;
};

// 그림 파일(seat.png)의 비율. 앞쪽이 오른쪽을 본다.
const IMAGE_RATIO = 574 / 720;

/**
 * 라벨을 붙일 그림 위 지점(그림 상자 기준 %)과 라벨을 놓을 쪽.
 * 한쪽 라벨끼리 세로로 라벨 높이보다 멀리 두어 겹치지 않게 한다 (그림 높이 360dp 기준).
 */
const ANCHORS: Record<
  SeatAxis,
  { x: number; y: number; side: "left" | "right" }
> = {
  headrestHeight: { x: 42, y: 6, side: "right" },
  headrestAngle: { x: 22, y: 10, side: "left" },
  beltHeight: { x: 8, y: 30, side: "left" },
  backrest: { x: 50, y: 30, side: "right" },
  lumbar: { x: 14, y: 54, side: "left" },
  tilt: { x: 95, y: 66, side: "right" },
  depth: { x: 82, y: 81, side: "right" },
  height: { x: 14, y: 82, side: "left" },
  foreAft: { x: 62, y: 97, side: "right" },
};

// 그림 크기: 창 높이의 40% 를 이 범위 안에서 쓴다.
const IMAGE_MIN_HEIGHT = 280;
const IMAGE_MAX_HEIGHT = 420;
// 그림 한쪽에 라벨을 놓을 폭. 가장 긴 라벨("↑ 좌판 앞쪽 올리기 21%")이 한 줄에 들어가는 폭이다.
const LABEL_ROOM = 440;

const percent = (ratio: number) => Math.round(ratio * 100);

const stageLabel = (guide: AxisGuide) =>
  `${AXIS_COPY[guide.axis].stage[guide.direction ?? "increase"]} ${percent(Math.abs(guide.target - guide.current))}%`;

const spokenLabel = (guide: AxisGuide) => {
  const copy = AXIS_COPY[guide.axis];
  return `${copy.label} ${copy.press[guide.direction ?? "increase"]} ${percent(Math.abs(guide.target - guide.current))}%`;
};

/**
 * 추천 자세를 시트 그림 위에 "어디를 어느 쪽으로"만 보여 준다. 정확한 숫자는 "숫자로 보기"에서 본다.
 * 차량 값이 없으면(지금 자세를 모르면) 방향을 알 수 없어 축 목록으로 보여 준다.
 */
export function BodyfitSeatStage({
  recommended,
  current,
  aside,
}: BodyfitSeatStageProps) {
  const styles = useStyles();
  const { height: windowHeight } = useWindowDimensions();
  const [numbers, setNumbers] = useState(false);
  // 카드 폭. 폭을 재서 그림을 키우지는 않으므로(높이는 창 높이로 정한다) 다시 재는 일이 되풀이되지 않는다.
  const [width, setWidth] = useState(0);

  if (!current) {
    return (
      <View style={styles.wrap}>
        <BodyfitSeatAxes recommended={recommended} current={null} />
        {aside ? <View style={styles.foot}>{aside}</View> : null}
      </View>
    );
  }

  const guide = guideSeat(current, recommended);
  const moves = guide.axes.filter((axis) => axis.direction !== null);
  const settled = guide.axes.length - moves.length;
  // 낮은 창에서도 탭·버튼과 함께 한 화면에 들어오게 창 높이에 맞춰 그림 크기를 정한다.
  const imageHeight = Math.max(
    IMAGE_MIN_HEIGHT,
    Math.min(IMAGE_MAX_HEIGHT, Math.round(windowHeight * 0.4)),
  );
  const imageWidth = Math.round(imageHeight * IMAGE_RATIO);
  // 그림 양옆에 라벨 자리가 없으면(좁은 창, 1:1 분할) 글자 목록으로 보여 준다.
  const picture = width >= imageWidth + LABEL_ROOM * 2;
  const summary =
    moves.length === 0
      ? "지금 자세가 딱 좋아요"
      : settled > 0
        ? `나머지 ${settled}곳은 지금 그대로 좋아요`
        : `${moves.length}곳을 맞춰요`;

  return (
    <View
      style={styles.wrap}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {numbers ? (
        <View style={styles.numbers}>
          <BodyfitSeatAxesLegend />
          <BodyfitSeatAxes recommended={recommended} current={current} />
        </View>
      ) : !picture ? (
        <View>
          {moves.map((move, index) => (
            <View
              key={move.axis}
              style={[styles.listRow, index > 0 && styles.divided]}
              accessible
              accessibilityLabel={spokenLabel(move)}
            >
              <AppText variant="bodyStrong">
                {AXIS_COPY[move.axis].label}
              </AppText>
              <AppText variant="secondary" tone="accent" style={styles.strong}>
                {AXIS_COPY[move.axis].press[move.direction ?? "increase"]}{" "}
                {percent(Math.abs(move.target - move.current))}%
              </AppText>
            </View>
          ))}
        </View>
      ) : (
        <View
          style={styles.stage}
          accessible
          accessibilityLabel={
            moves.length === 0
              ? summary
              : `시트 그림. ${moves.map(spokenLabel).join(", ")}`
          }
        >
          <View style={{ height: imageHeight, width: imageWidth }}>
            <BodyfitSeatImage height="fill" />
            {moves.map((move) => {
              const anchor = ANCHORS[move.axis];
              return (
                // 점과 라벨은 그림 상자를 기준으로 놓는다 (감싸는 View 를 두면 높이 0 인 상자가 기준이 된다).
                <Fragment key={move.axis}>
                  <View
                    style={[
                      styles.dot,
                      { left: `${anchor.x}%`, top: `${anchor.y}%` },
                    ]}
                  />
                  {/* 라벨 줄: 점 바로 옆에서 바깥쪽으로 LABEL_ROOM 폭을 차지하고, 라벨은 내용 폭만큼만 칠한다. */}
                  <View
                    style={[
                      styles.labelRow,
                      { top: `${anchor.y}%` },
                      anchor.side === "right"
                        ? [styles.labelRight, { left: `${anchor.x}%` }]
                        : [styles.labelLeft, { right: `${100 - anchor.x}%` }],
                    ]}
                  >
                    <View style={styles.pill}>
                      <AppText
                        variant="secondary"
                        tone="inverse"
                        style={styles.strong}
                        numberOfLines={1}
                      >
                        {stageLabel(move)}
                      </AppText>
                    </View>
                  </View>
                </Fragment>
              );
            })}
          </View>
        </View>
      )}
      <View style={styles.foot}>
        <AppText variant="caption" tone="tertiary" style={styles.footText}>
          {summary}
        </AppText>
        {aside}
        {moves.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: numbers }}
            onPress={() => setNumbers((open) => !open)}
            style={({ pressed }) => [
              styles.toggle,
              pressed && styles.togglePressed,
            ]}
          >
            <AppText variant="secondary" tone="accent" style={styles.strong}>
              {numbers ? "그림으로 보기 ›" : "숫자로 보기 ›"}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const DOT = 20;
const PILL_HEIGHT = 52;

const useStyles = themedStyles((colors) => ({
  // 탭 카드 안 구역: Card 구역과 같은 위 여백
  wrap: { gap: spacing.sm, paddingTop: spacing.lg },
  numbers: { gap: spacing.sm },
  // 라벨이 그림 양옆으로 나가므로 가운데에 두고 위아래로 라벨 반만큼 여유를 둔다.
  stage: {
    alignItems: "center",
    paddingVertical: PILL_HEIGHT / 2,
  },
  dot: {
    position: "absolute",
    marginLeft: -DOT / 2,
    marginTop: -DOT / 2,
    width: DOT,
    height: DOT,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
  },
  labelRow: {
    position: "absolute",
    width: LABEL_ROOM,
    height: PILL_HEIGHT,
    marginTop: -PILL_HEIGHT / 2,
    flexDirection: "row",
    alignItems: "center",
  },
  labelRight: {
    justifyContent: "flex-start",
    paddingLeft: DOT / 2 + spacing.xs,
  },
  labelLeft: {
    justifyContent: "flex-end",
    paddingRight: DOT / 2 + spacing.xs,
  },
  pill: {
    minHeight: PILL_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  strong: { fontWeight: "700" },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  footText: { flex: 1 },
  toggle: {
    minHeight: sizes.touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control,
  },
  togglePressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.98 }],
  },
}));
