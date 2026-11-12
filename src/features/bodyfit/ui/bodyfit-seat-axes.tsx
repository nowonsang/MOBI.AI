import { useState } from "react";
import { Pressable, View } from "react-native";

import { SEAT_AXES } from "@/shared/pleos/pleos.types";
import { AppText } from "@/shared/ui/app-text";
import { IconBadge } from "@/shared/ui/icon-badge";
import { radius, sizes, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import {
  axesToRemember,
  groupSeatAxes,
  recommendationForVehicle,
} from "../model/bodyfit-axis-group";
import { GUIDE_TOLERANCE } from "../model/bodyfit-guide";
import type { SeatAxis, SeatRatios } from "../model/bodyfit.types";
import { AXIS_COPY, describeAxesToRemember } from "./bodyfit-axis-copy";
import { BodyfitAxisGroupHeading } from "./bodyfit-axis-group-heading";

const percent = (ratio: number) => Math.round(ratio * 100);

type BodyfitSeatAxesProps = {
  recommended: SeatRatios;
  /** 차량에서 읽은 현재 자세. 차량이 없으면 null */
  current: SeatRatios | null;
};

type AxisRowProps = { axis: SeatAxis; target: number; now: number | undefined };
type AxisRowViewProps = AxisRowProps & { last: boolean };

// 축이 이보다 많으면 이미 맞는 축을 한 줄로 접는다. 기본 네 축만 있는 차량에서는 접지 않는다.
const FOLD_ABOVE = 4;

// 가이드 조절과 같은 기준(범위의 3%)으로 맞았는지 본다.
const isSettled = ({ now, target }: AxisRowProps) =>
  now !== undefined && Math.abs(now - target) <= GUIDE_TOLERANCE;

// 색만으로 구분하지 않도록 막대 옆에 "지금 → 추천" 숫자를 함께 쓴다.
export function BodyfitSeatAxes({
  recommended,
  current,
}: BodyfitSeatAxesProps) {
  const styles = useStyles();
  const [settledOpen, setSettledOpen] = useState(false);
  // 좌판 길이·헤드레스트·안전벨트는 차량이 알려 줄 때만 보여 준다. 없는 차량에서는 기본 네 축 그대로다.
  const shown = recommendationForVehicle(recommended, current);
  const rows = SEAT_AXES.flatMap((axis): AxisRowProps[] => {
    const target = shown[axis];
    return target === undefined ? [] : [{ axis, target, now: current?.[axis] }];
  });
  // 조절할 곳을 먼저 보여 주고, 이미 맞는 곳은 "맞는 곳 N곳 보기" 한 줄로 접어 둔다 (아홉 축까지 늘어도 한 화면에 들어오게).
  const fold = rows.length > FOLD_ABOVE && rows.some(isSettled);
  const settled = fold ? rows.filter(isSettled) : [];
  const groups = groupSeatAxes(
    fold ? rows.filter((row) => !isSettled(row)) : rows,
  );
  // 묶음이 하나뿐이면 제목 없이 죽 보여 준다.
  const titled = groups.length > 1;
  // 허리 지지대·헤드레스트 각도는 기록이 쌓이기 전에는 추천하지 않는다. 이 차량에 있으면 왜 안 보이는지 한 줄로 알린다.
  const toRemember = describeAxesToRemember(
    axesToRemember(recommended, current),
  );

  return (
    <View style={styles.list}>
      {groups.map((group, index) => (
        <View key={group.id} style={styles.group}>
          {titled ? (
            <BodyfitAxisGroupHeading
              group={group.id}
              note={`${group.items.length}곳`}
              divided={index > 0}
            />
          ) : null}
          <View style={styles.list}>
            {group.items.map((row, rowIndex) => (
              <AxisRow
                key={row.axis}
                {...row}
                last={rowIndex === group.items.length - 1}
              />
            ))}
          </View>
        </View>
      ))}
      {settled.length > 0 ? (
        <View style={[styles.settled, groups.length > 0 && styles.divided]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: settledOpen }}
            accessibilityLabel={`맞는 곳 ${settled.length}곳 ${settledOpen ? "접기" : "보기"}`}
            onPress={() => setSettledOpen((open) => !open)}
            style={({ pressed }) => [
              styles.foldRow,
              pressed && styles.foldPressed,
            ]}
          >
            <AppText variant="secondary" style={styles.okText}>
              {`✓ 맞는 곳 ${settled.length}곳 ${settledOpen ? "접기" : "보기"}`}
            </AppText>
            <AppText variant="heading" tone="tertiary">
              {settledOpen ? "▴" : "▾"}
            </AppText>
          </Pressable>
          {settledOpen ? (
            <View style={styles.list}>
              {settled.map((row, rowIndex) => (
                <AxisRow
                  key={row.axis}
                  {...row}
                  last={rowIndex === settled.length - 1}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {toRemember ? (
        <AppText variant="caption" tone="tertiary">
          {toRemember}
        </AppText>
      ) : null}
    </View>
  );
}

function AxisRow({ axis, target, now, last }: AxisRowViewProps) {
  const styles = useStyles();
  const copy = AXIS_COPY[axis];
  const ok = isSettled({ axis, target, now });
  const value =
    now === undefined
      ? `추천 ${percent(target)}%`
      : ok
        ? `✓ 맞아요 ${percent(now)}%`
        : `지금 ${percent(now)}% → 추천 ${percent(target)}%`;
  const low = now === undefined ? target : Math.min(now, target);
  const high = now === undefined ? target : Math.max(now, target);

  return (
    <View
      style={[styles.row, last && styles.rowLast]}
      accessible
      accessibilityLabel={`${copy.label}, ${value}. ${copy.min}에서 ${copy.max} 사이`}
    >
      <IconBadge glyph={copy.glyph} tone="muted" />
      <View style={styles.body}>
        <View style={styles.heading}>
          <AppText variant="bodyStrong">{copy.label}</AppText>
          {ok ? (
            <AppText variant="secondary" style={styles.okText}>
              {value}
            </AppText>
          ) : now === undefined ? (
            <AppText variant="secondary" tone="accent">
              {value}
            </AppText>
          ) : (
            <AppText variant="secondary" tone="secondary">
              {`지금 ${percent(now)}% → `}
              <AppText variant="secondary" tone="accent" style={styles.strong}>
                {`추천 ${percent(target)}%`}
              </AppText>
            </AppText>
          )}
        </View>
        <View style={styles.track}>
          {/* 지금과 추천 사이를 옅은 파랑으로 칠해 얼마나 움직일지 보여 준다 */}
          {!ok && now !== undefined ? (
            <View
              style={[
                styles.span,
                {
                  left: `${percent(low)}%`,
                  width: `${percent(high) - percent(low)}%`,
                },
              ]}
            />
          ) : null}
          {now !== undefined ? (
            <View
              style={[
                styles.marker,
                styles.current,
                { left: `${percent(now)}%` },
              ]}
            />
          ) : null}
          <View
            style={[
              styles.marker,
              styles.recommended,
              { left: `${percent(target)}%` },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

/** 막대의 회색 점·파란 점이 무엇인지 알려 주는 범례. 카드 제목 아래에 둔다 */
export function BodyfitSeatAxesLegend() {
  const styles = useStyles();
  return (
    <View
      style={styles.legend}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, styles.legendCurrent]} />
        <AppText variant="caption" tone="tertiary">
          지금
        </AppText>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.legendDot, styles.recommended]} />
        <AppText variant="caption" tone="tertiary">
          추천
        </AppText>
      </View>
    </View>
  );
}

const TRACK_HEIGHT = 8;
const DOT = 28;
const CURRENT_DOT = 20;
const LEGEND_DOT = 16;

const useStyles = themedStyles((colors) => ({
  list: { gap: spacing.sm },
  // 묶음 제목은 그 묶음의 첫 축에 붙여 둔다 (축 사이보다 좁게).
  group: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLast: { paddingBottom: 0, borderBottomWidth: 0 },
  // 접힌 "맞는 곳" 줄. 위에 조절할 축이 있으면 선으로 나눈다.
  settled: { gap: spacing.sm },
  divided: { borderTopWidth: 1, borderTopColor: colors.line },
  foldRow: {
    minHeight: sizes.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  // Pleos 인터랙션 가이드: 눌린 요소는 줄이고 배경색을 바꾼다.
  foldPressed: {
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.98 }],
  },
  body: { flex: 1, gap: spacing.sm },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  strong: { fontWeight: "700" },
  okText: { color: colors.success, fontWeight: "700" },
  track: {
    height: TRACK_HEIGHT,
    marginVertical: spacing.xs,
    // 점이 양 끝에서 잘리지 않게 점 반지름만큼 안쪽에 둔다
    marginHorizontal: DOT / 2,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  span: {
    position: "absolute",
    top: 0,
    height: TRACK_HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  marker: {
    position: "absolute",
    top: (TRACK_HEIGHT - DOT) / 2,
    width: DOT,
    height: DOT,
    marginLeft: -DOT / 2,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: colors.surface,
  },
  // 지금 = 작은 회색 점, 추천 = 큰 파란 점. 색만으로 구분하지 않도록 크기도 다르고, 위에 숫자를 함께 쓴다.
  current: {
    backgroundColor: colors.inkDisabled,
    width: CURRENT_DOT,
    height: CURRENT_DOT,
    top: (TRACK_HEIGHT - CURRENT_DOT) / 2,
    marginLeft: -CURRENT_DOT / 2,
    borderWidth: 3,
  },
  recommended: { backgroundColor: colors.primary },
  legend: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: {
    width: LEGEND_DOT,
    height: LEGEND_DOT,
    borderRadius: radius.pill,
  },
  legendCurrent: { backgroundColor: colors.inkDisabled },
}));
