import { View } from "react-native";

import { SEAT_AXES } from "@/shared/pleos/pleos.types";
import { AppText } from "@/shared/ui/app-text";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import {
  groupSeatAxes,
  recommendationForVehicle,
} from "../model/bodyfit-axis-group";
import type { SeatAxis, SeatRatios } from "../model/bodyfit.types";
import { AXIS_COPY } from "./bodyfit-axis-copy";
import { BodyfitAxisGroupHeading } from "./bodyfit-axis-group-heading";

const percent = (ratio: number) => Math.round(ratio * 100);

type BodyfitSeatAxesProps = {
  recommended: SeatRatios;
  /** 차량에서 읽은 현재 자세. 차량이 없으면 null */
  current: SeatRatios | null;
};

type AxisRowProps = { axis: SeatAxis; target: number; now: number | undefined };

// 색만으로 구분하지 않도록 막대 옆에 "지금 → 추천" 숫자를 함께 쓴다.
export function BodyfitSeatAxes({
  recommended,
  current,
}: BodyfitSeatAxesProps) {
  const styles = useStyles();
  // 좌판 길이·헤드레스트·안전벨트는 차량이 알려 줄 때만 보여 준다. 없는 차량에서는 기본 네 축 그대로다.
  const shown = recommendationForVehicle(recommended, current);
  const rows = SEAT_AXES.flatMap((axis): AxisRowProps[] => {
    const target = shown[axis];
    return target === undefined ? [] : [{ axis, target, now: current?.[axis] }];
  });
  const groups = groupSeatAxes(rows);
  // 묶음이 하나뿐이면 제목 없이 죽 보여 준다.
  const titled = groups.length > 1;

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
            {group.items.map((row) => (
              <AxisRow key={row.axis} {...row} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function AxisRow({ axis, target, now }: AxisRowProps) {
  const styles = useStyles();
  const copy = AXIS_COPY[axis];
  return (
    <View style={styles.row}>
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
}

const TRACK_HEIGHT = 8;
const DOT = 28;

const useStyles = themedStyles((colors) => ({
  list: { gap: spacing.lg },
  // 묶음 제목은 그 묶음의 첫 축에 붙여 둔다 (축 사이보다 좁게).
  group: { gap: spacing.md },
  row: { gap: spacing.xs },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  track: {
    height: TRACK_HEIGHT,
    marginVertical: spacing.sm,
    // 점이 양 끝에서 잘리지 않게 점 반지름만큼 안쪽에 둔다
    marginHorizontal: DOT / 2,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  marker: {
    position: "absolute",
    top: (TRACK_HEIGHT - DOT) / 2,
    width: DOT,
    height: DOT,
    marginLeft: -DOT / 2,
    borderRadius: radius.pill,
  },
  // 지금 = 회색 점, 추천 = 파란 점. 색만으로 구분하지 않도록 위에 "지금 → 추천" 숫자를 함께 쓴다.
  current: { backgroundColor: colors.inkDisabled },
  recommended: { backgroundColor: colors.primary },
  ends: { flexDirection: "row", justifyContent: "space-between" },
}));
