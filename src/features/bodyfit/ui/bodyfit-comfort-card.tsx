import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";

import { canControlComfort } from "@/shared/config/app-variant";
import type { DriverComfortState } from "@/shared/pleos/pleos.types";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { IconBadge } from "@/shared/ui/icon-badge";
import { InfoRow } from "@/shared/ui/info-row";
import { StatusView } from "@/shared/ui/status-view";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { useApplyComfort } from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { speakQuietly } from "../api/bodyfit.voice";
import {
  comfortChanges,
  isFanManual,
  recommendComfort,
} from "../model/bodyfit-comfort";
import type { ComfortSettings, FanDirection } from "../model/bodyfit.types";
import { describeComfortError } from "./bodyfit-error-copy";

type ComfortKey = keyof ComfortSettings;

// 단계 값: 양수 = 단계, 0 = 꺼짐. 시트·핸들 열선은 음수면 냉각이다 (차량 규약). 단계가 하나뿐이면 "켬".
const describeLevel = (value: number, max: number | undefined) =>
  value > 0
    ? max === 1
      ? "켬"
      : `${value}단`
    : value < 0
      ? `냉각 ${-value}단`
      : "꺼짐";
const describeTemp = (value: number) => `${Number(value.toFixed(1))}℃`;

// 바람 방향은 공조 버튼의 그림 대신 바람이 닿는 곳으로 부른다.
const FAN_DIRECTION_COPY: Record<FanDirection, string> = {
  face: "얼굴",
  floor: "발",
  faceFloor: "얼굴과 발",
  defrost: "앞유리",
  faceDefrost: "얼굴과 앞유리",
  floorDefrost: "발과 앞유리",
  faceFloorDefrost: "얼굴·발·앞유리",
};

const ROWS: { key: ComfortKey; label: string; glyph: string }[] = [
  { key: "seatHeat", label: "시트 열선", glyph: "♨" },
  { key: "seatVent", label: "시트 통풍", glyph: "∽" },
  { key: "steeringHeat", label: "핸들 열선", glyph: "◎" },
  { key: "cabinTarget", label: "실내 온도", glyph: "℃" },
  { key: "fanSpeed", label: "풍량", glyph: "≈" },
  { key: "fanDirection", label: "바람 방향", glyph: "↘" },
];

const isFanRow = (key: ComfortKey) =>
  key === "fanSpeed" || key === "fanDirection";

// 한 칸에 아이콘과 "얼굴과 앞유리" 같은 값이 한 줄로 들어가는 최소 폭. 카드가 이 두 배보다 넓으면 두 칸씩 놓인다.
const ROW_MIN_WIDTH = 320;

const describe = (
  key: ComfortKey,
  value: number | FanDirection,
  state: DriverComfortState | undefined,
) =>
  typeof value === "string"
    ? FAN_DIRECTION_COPY[value]
    : key === "cabinTarget"
      ? describeTemp(value)
      : describeLevel(
          value,
          key === "fanDirection" ? undefined : state?.[key]?.max,
        );

/**
 * 운전석 온도 취향: 출발할 때의 열선·통풍·공조 설정을 기억해 두었다가, 탈 때 실내 온도가 비슷한 날의 설정으로 맞춘다.
 * 맞추기는 주차(P) 중 화면에서 운전자가 누를 때만 한다.
 */
export function BodyfitComfortCard({
  profileId,
  vehicleConnected,
  parked,
}: {
  profileId: string;
  vehicleConnected: boolean;
  parked: boolean;
}) {
  const styles = useStyles();
  const records = useQuery(bodyfitQueries.comfortRecords(profileId));
  const comfort = useQuery({
    ...bodyfitQueries.comfort(),
    enabled: vehicleConnected,
  });
  const apply = useApplyComfort();
  const [notice, setNotice] = useState<string | null>(null);

  const state = comfort.data;
  const cabinNow = state?.cabinCurrent ?? null;
  const recommendation = records.data
    ? recommendComfort(records.data, cabinNow)
    : null;
  const changes: ComfortSettings =
    recommendation && state
      ? comfortChanges(state, recommendation.settings)
      : {};
  const changeCount = Object.keys(changes).length;

  // 풍량·바람 방향은 자동 공조이거나 공조가 꺼져 있으면 건드리지 않는다. 그 이유를 행과 카드 아래에 알린다.
  const fanHeld = state && !isFanManual(state) ? state.fanMode : undefined;
  const recommendsFan =
    recommendation?.settings.fanSpeed !== undefined ||
    recommendation?.settings.fanDirection !== undefined;

  // 지금 값은 바뀔 항목에만 붙인다: 여섯 줄을 다 읽지 않아도 무엇이 달라지는지 보이게 한다.
  const detailFor = (key: ComfortKey): string | undefined => {
    if (!state) return undefined;
    if (isFanRow(key) && fanHeld && state[key])
      return fanHeld === "auto" ? "지금 자동" : "지금 꺼짐";
    if (changes[key] === undefined) return undefined;
    const now = state[key]?.value;
    return now === undefined ? undefined : `지금 ${describe(key, now, state)}`;
  };

  const applyComfort = () =>
    apply.mutate(changes, {
      onSuccess: () => {
        setNotice("평소 온도로 맞췄어요");
        void speakQuietly("평소 좋아하시는 온도로 맞췄어요");
      },
    });

  const basis = !recommendation
    ? null
    : recommendation.similarCabin && cabinNow !== null
      ? `지금 실내 ${describeTemp(Math.round(cabinNow))}와 비슷한 날의 설정이에요`
      : "최근 출발 기록으로 골랐어요";

  return (
    <Card
      title="내 운전석 온도"
      count={recommendation ? `${recommendation.basedOn}건` : undefined}
    >
      {records.isPending ? (
        <View style={styles.skeleton} accessibilityLabel="불러오는 중" />
      ) : !recommendation ? (
        <AppText variant="secondary" tone="secondary">
          아직 기록이 없어요. 출발할 때의 열선·통풍·온도·바람부터 자동으로
          기억해요
        </AppText>
      ) : (
        <View style={styles.rows}>
          {basis ? (
            <AppText variant="caption" tone="tertiary">
              {basis}
            </AppText>
          ) : null}
          <View style={styles.grid}>
            {ROWS.map(({ key, label, glyph }) => {
              const wanted = recommendation.settings[key];
              if (wanted === undefined) return null;
              return (
                <View key={key} style={styles.cell}>
                  <InfoRow
                    icon={<IconBadge glyph={glyph} />}
                    label={label}
                    value={describe(key, wanted, state)}
                    detail={detailFor(key)}
                  />
                </View>
              );
            })}
          </View>
          {fanHeld && recommendsFan ? (
            <AppText variant="caption" tone="tertiary">
              {fanHeld === "auto"
                ? "자동 공조 중이라 풍량과 바람 방향은 그대로 둬요"
                : "공조가 꺼져 있어 풍량과 바람 방향은 그대로 둬요"}
            </AppText>
          ) : null}
        </View>
      )}

      {canControlComfort && recommendation && vehicleConnected ? (
        <View style={styles.action}>
          <Button
            label={
              changeCount > 0 ? "평소 온도로 맞추기" : "평소 온도와 같아요"
            }
            variant="secondary"
            onPress={applyComfort}
            disabled={!parked || changeCount === 0 || !state}
            loading={apply.isPending}
            accessibilityHint="열선과 통풍, 실내 온도, 바람을 평소 설정으로 바꿔요"
          />
          {!parked ? (
            <AppText variant="caption" tone="tertiary">
              주차(P) 중에만 바꿔요
            </AppText>
          ) : null}
        </View>
      ) : null}

      {notice ? (
        <AppText
          variant="secondary"
          tone="secondary"
          accessibilityLiveRegion="polite"
        >
          {notice}
        </AppText>
      ) : null}
      {apply.error ? (
        <StatusView {...describeComfortError(apply.error)} />
      ) : null}
    </Card>
  );
}

const useStyles = themedStyles((colors) => ({
  rows: { gap: spacing.xs },
  // 항목이 여섯 개까지 늘어 한 줄에 두 칸씩 놓는다. 좁은 창에서는 한 칸씩 쌓인다.
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  cell: { flexBasis: ROW_MIN_WIDTH, flexGrow: 1 },
  skeleton: {
    height: 160,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  action: { gap: spacing.xs, marginTop: spacing.sm },
}));
