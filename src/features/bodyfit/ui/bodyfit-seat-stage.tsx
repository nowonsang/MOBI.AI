import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { radius, sizes, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { guideSeat, type AxisGuide } from "../model/bodyfit-guide";
import type { SeatRatios } from "../model/bodyfit.types";
import { AXIS_COPY } from "./bodyfit-axis-copy";
import { BodyfitSeatAxes, BodyfitSeatAxesLegend } from "./bodyfit-seat-axes";
import { BodyfitSeatPicture } from "./bodyfit-seat-picture";

type BodyfitSeatStageProps = {
  recommended: SeatRatios;
  /** 차량에서 읽은 현재 자세(시연 모드에서는 모의 위치). 차량이 없으면 null */
  current: SeatRatios | null;
  /** 아래 줄 오른쪽, "숫자로 보기" 앞에 둘 조용한 버튼 (예: 시연 모드) */
  aside?: ReactNode;
};

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
  const [numbers, setNumbers] = useState(false);

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
  const summary =
    moves.length === 0
      ? "지금 자세가 딱 좋아요"
      : settled > 0
        ? `나머지 ${settled}곳은 지금 그대로 좋아요`
        : `${moves.length}곳을 맞춰요`;

  return (
    <View style={styles.wrap}>
      {numbers ? (
        <View style={styles.numbers}>
          <BodyfitSeatAxesLegend />
          <BodyfitSeatAxes recommended={recommended} current={current} />
        </View>
      ) : (
        <BodyfitSeatPicture
          marks={moves.map((move) => ({
            axis: move.axis,
            text: stageLabel(move),
            tone: "active" as const,
          }))}
          accessibilityLabel={
            moves.length === 0
              ? summary
              : `시트 그림. ${moves.map(spokenLabel).join(", ")}`
          }
          // 좁은 창(1:1 분할)에서는 그림 양옆에 라벨 자리가 없어 글자 목록으로 보여 준다.
          fallback={
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
                  <AppText
                    variant="secondary"
                    tone="accent"
                    style={styles.strong}
                  >
                    {AXIS_COPY[move.axis].press[move.direction ?? "increase"]}{" "}
                    {percent(Math.abs(move.target - move.current))}%
                  </AppText>
                </View>
              ))}
            </View>
          }
        />
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

const useStyles = themedStyles((colors) => ({
  // 탭 카드 안 구역: Card 구역과 같은 위 여백
  wrap: { gap: spacing.sm, paddingTop: spacing.lg },
  numbers: { gap: spacing.sm },
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
