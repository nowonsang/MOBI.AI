import { StyleSheet, View } from "react-native";

import { SEAT_AXES } from "@/shared/pleos/pleos.types";
import { AppText } from "@/shared/ui/app-text";
import { colors, radius, spacing } from "@/shared/ui/theme";

import type { SeatAxis, SeatRatios } from "../model/bodyfit.types";

const AXIS_COPY: Record<SeatAxis, { label: string; min: string; max: string }> =
  {
    foreAft: { label: "앞뒤 위치", min: "뒤", max: "앞" },
    height: { label: "높이", min: "낮게", max: "높게" },
    backrest: { label: "등받이", min: "눕힘", max: "세움" },
    tilt: { label: "좌판 기울기", min: "내림", max: "올림" },
  };

const percent = (ratio: number) => Math.round(ratio * 100);

type BodyfitSeatAxesProps = {
  recommended: SeatRatios;
  /** 차량에서 읽은 현재 자세. 차량이 없으면 null */
  current: SeatRatios | null;
};

// 색만으로 구분하지 않도록 막대 옆에 "지금 → 추천" 숫자를 함께 쓴다.
export function BodyfitSeatAxes({ recommended, current }: BodyfitSeatAxesProps) {
  return (
    <View style={styles.list}>
      {SEAT_AXES.map((axis) => {
        const target = recommended[axis];
        if (target === undefined) return null;
        const now = current?.[axis];
        const copy = AXIS_COPY[axis];
        return (
          <View key={axis} style={styles.row}>
            <View style={styles.heading}>
              <AppText variant="bodyStrong">{copy.label}</AppText>
              <AppText variant="secondary" tone="secondary">
                {now === undefined
                  ? `추천 ${percent(target)}%`
                  : `지금 ${percent(now)}% → 추천 ${percent(target)}%`}
              </AppText>
            </View>
            <View style={styles.track} accessible={false}>
              {now !== undefined ? (
                <View
                  style={[styles.marker, styles.current, { left: `${percent(now)}%` }]}
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
            <View style={styles.ends}>
              <AppText variant="caption" tone="tertiary">
                {copy.min}
              </AppText>
              <AppText variant="caption" tone="tertiary">
                {copy.max}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const MARKER_WIDTH = 12;

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  row: { gap: spacing.xs },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  track: {
    height: 16,
    marginVertical: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.line,
  },
  marker: {
    position: "absolute",
    top: -8,
    width: MARKER_WIDTH,
    height: 32,
    marginLeft: -MARKER_WIDTH / 2,
    borderRadius: radius.control,
  },
  current: {
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.inkTertiary,
  },
  recommended: { backgroundColor: colors.primary },
  ends: { flexDirection: "row", justifyContent: "space-between" },
});
