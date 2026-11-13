import { View } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { radius, sizes, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { formatMinutes } from "./bodyfit-posture-copy";

type Props = {
  /** 출발 자세를 유지한 시간(분) */
  heldMin: number;
  /** 쏠리기 시작한 뒤부터 도착까지(분) */
  driftMin: number;
  /** 다른 주행과 같은 눈금으로 견줄 때의 전체 길이(분). 없으면 이 주행 길이가 막대 전체다 */
  scaleMin?: number;
  /** 쏠리기 시작한 때를 막대 위에 표시한다 ("50분부터") */
  marker?: boolean;
  /** 막대 아래에 "출발 · 도착" 눈금 글자를 둔다 */
  axis?: boolean;
  /** 지난 주행에서 쏠리기 시작한 때(분). 막대 안에 점선으로 표시한다 */
  previousDriftStartMin?: number | null;
};

// 막대 안 글자가 잘리지 않는 최소 폭 비율. 이보다 좁은 구간은 글자를 빼고 범례가 대신 알려 준다.
const LABEL_MIN_SHARE = 0.26;
// 표시(알약)가 카드 밖으로 나가지 않게, 가장자리 근처에서는 가운데가 아니라 한쪽 끝을 맞춘다.
const MARKER_EDGE = 0.16;

/**
 * 출발부터 도착까지를 한 줄 막대로 보여 준다: 초록 = 출발 자세 유지, 주황 = 앞으로 쏠림.
 * 색만으로 구분하지 않게 구간 안에 글자를 쓰고(순서도 항상 유지 → 쏠림), 범례를 함께 둔다.
 */
export function BodyfitPostureTimeline({
  heldMin,
  driftMin,
  scaleMin,
  marker = false,
  axis = false,
  previousDriftStartMin,
}: Props) {
  const styles = useStyles();
  const total = heldMin + driftMin;
  if (total <= 0) return null;
  const scale = Math.max(scaleMin ?? total, total);
  const widthShare = total / scale;
  const heldShare = heldMin / total;
  const fits = (minutes: number) => minutes / scale >= LABEL_MIN_SHARE;
  const showPrevious =
    previousDriftStartMin !== null &&
    previousDriftStartMin !== undefined &&
    previousDriftStartMin > 0 &&
    previousDriftStartMin < total;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        driftMin > 0
          ? `출발 자세 유지 ${formatMinutes(heldMin)}, 그 뒤 앞으로 쏠림 ${formatMinutes(driftMin)}`
          : `${formatMinutes(heldMin)} 동안 출발 자세 유지`
      }
      style={[styles.box, { width: `${widthShare * 100}%` }]}
    >
      {marker && driftMin > 0 ? (
        <View style={styles.markerRow}>
          <View
            style={[
              styles.marker,
              { left: `${heldShare * 100}%` },
              {
                transform: [
                  {
                    translateX:
                      heldShare < MARKER_EDGE
                        ? "0%"
                        : heldShare > 1 - MARKER_EDGE
                          ? "-100%"
                          : "-50%",
                  },
                ],
              },
            ]}
          >
            <AppText variant="caption" style={styles.strong}>
              {formatMinutes(heldMin)}부터
            </AppText>
          </View>
        </View>
      ) : null}
      <View style={styles.bar}>
        {heldMin > 0 ? (
          <View style={[styles.segment, styles.held, { flex: heldMin }]}>
            {fits(heldMin) ? (
              <AppText
                variant="caption"
                tone="inverse"
                numberOfLines={1}
                style={styles.strong}
              >
                유지 {formatMinutes(heldMin)}
              </AppText>
            ) : null}
          </View>
        ) : null}
        {driftMin > 0 ? (
          <View style={[styles.segment, styles.drift, { flex: driftMin }]}>
            {fits(driftMin) ? (
              <AppText
                variant="caption"
                tone="inverse"
                numberOfLines={1}
                style={styles.strong}
              >
                쏠림 {formatMinutes(driftMin)}
              </AppText>
            ) : null}
          </View>
        ) : null}
        {showPrevious ? (
          <View
            style={[
              styles.previous,
              { left: `${((previousDriftStartMin ?? 0) / total) * 100}%` },
            ]}
          >
            <View style={styles.previousDot} />
            <View style={styles.previousDot} />
            <View style={styles.previousDot} />
            <View style={styles.previousDot} />
            <View style={styles.previousDot} />
          </View>
        ) : null}
      </View>
      {axis ? (
        <View style={styles.axis}>
          <AppText variant="caption" tone="tertiary">
            출발
          </AppText>
          <AppText variant="caption" tone="tertiary">
            도착
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/** 막대 색의 뜻. previousDriftStartMin 을 주면 점선(지난 주행에서 쏠리기 시작한 때)도 설명한다 */
export function BodyfitPostureTimelineLegend({
  previousDriftStartMin,
}: {
  previousDriftStartMin?: number | null;
}) {
  const styles = useStyles();
  return (
    <View style={styles.legend}>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, styles.held]} />
        <AppText variant="caption" tone="secondary">
          출발 자세 유지
        </AppText>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.swatch, styles.drift]} />
        <AppText variant="caption" tone="secondary">
          앞으로 쏠림
        </AppText>
      </View>
      {previousDriftStartMin ? (
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.held, styles.swatchDots]}>
            <View style={styles.swatchDot} />
            <View style={styles.swatchDot} />
          </View>
          <AppText variant="caption" tone="secondary">
            점선: 지난번에 쏠리기 시작한 때 (
            {formatMinutes(previousDriftStartMin)})
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  box: { gap: spacing.xs },
  markerRow: { height: 48 },
  // 옅은 파랑 면 + ink 글자 (theme.test 의 검사 조합)
  marker: {
    position: "absolute",
    top: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  strong: { fontWeight: "700" },
  bar: {
    flexDirection: "row",
    minHeight: sizes.touchTarget,
    borderRadius: radius.control,
    overflow: "hidden",
  },
  segment: {
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  held: { backgroundColor: colors.success },
  drift: { backgroundColor: colors.warning },
  previous: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 4,
    justifyContent: "space-evenly",
  },
  previousDot: { height: 8, backgroundColor: colors.onPrimary },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.lg,
    rowGap: spacing.xs,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
  },
  swatch: { width: 24, height: 24, borderRadius: 6 },
  swatchDots: { alignItems: "center", justifyContent: "space-evenly" },
  swatchDot: { width: 4, height: 6, backgroundColor: colors.onPrimary },
}));
