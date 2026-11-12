import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { canControlComfort } from "@/shared/config/app-variant";
import type { DriverComfortState } from "@/shared/pleos/pleos.types";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { StatusView } from "@/shared/ui/status-view";
import { radius, sizes, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { useApplyComfort } from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { speakQuietly } from "../api/bodyfit.voice";
import {
  AMBIENT_KEYS,
  comfortChanges,
  hasAmbient,
  isFanManual,
  recommendComfort,
} from "../model/bodyfit-comfort";
import type { ComfortSettings, FanDirection } from "../model/bodyfit.types";
import { describeComfortError } from "./bodyfit-error-copy";

// 무드등 세 항목(켜짐·밝기·색)은 타일 하나로 묶어 따로 그린다.
type ComfortKey = Exclude<keyof ComfortSettings, (typeof AMBIENT_KEYS)[number]>;

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

const ROWS: { key: ComfortKey; label: string }[] = [
  { key: "seatHeat", label: "시트 열선" },
  { key: "seatVent", label: "시트 통풍" },
  { key: "steeringHeat", label: "핸들 열선" },
  { key: "mirrorHeat", label: "사이드미러 열선" },
  { key: "cabinTarget", label: "실내 온도" },
  { key: "fanSpeed", label: "풍량" },
  { key: "fanDirection", label: "바람 방향" },
];

const isFanRow = (key: ComfortKey) =>
  key === "fanSpeed" || key === "fanDirection";

// 타일 최소 폭. 오른쪽 단(60%) 카드에서는 한 줄에 세 칸, 좁은 창에서는 한두 칸씩 놓인다.
const TILE_MIN_WIDTH = 220;

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

// 무드등 밝기: 단계가 적은 차는 "3단", 0~100 처럼 촘촘한 차는 범위 안의 비율로 읽어 준다.
const describeBrightness = (
  value: number,
  range: { min: number; max: number } | undefined,
) =>
  !range || range.max <= 10 || range.max <= range.min
    ? `밝기 ${value}단`
    : `밝기 ${Math.round(((value - range.min) / (range.max - range.min)) * 100)}%`;

/** 무드등 타일 글자. 색 값은 차종마다 뜻이 달라 색 이름 대신 "평소 색"으로 부른다. */
function describeAmbient(
  wanted: ComfortSettings,
  changes: ComfortSettings,
  state: DriverComfortState | undefined,
): { value: string; detail?: string } {
  if (wanted.ambientOn === false)
    return {
      value: "꺼짐",
      detail: changes.ambientOn === false ? "지금 켜짐" : undefined,
    };
  const range = state?.ambientBrightness;
  const value = [
    wanted.ambientOn ? "켬" : null,
    wanted.ambientBrightness !== undefined
      ? describeBrightness(wanted.ambientBrightness, range)
      : null,
    wanted.ambientColor !== undefined ? "평소 색" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const detail = [
    changes.ambientOn ? "지금 꺼짐" : null,
    changes.ambientBrightness !== undefined && range
      ? `지금 ${describeBrightness(range.value, range)}`
      : null,
    changes.ambientColor !== undefined ? "지금 다른 색" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return { value, detail: detail || undefined };
}

/**
 * 운전석 온도 취향: 출발할 때의 열선·통풍·공조 설정을 기억해 두었다가, 탈 때 실내 온도가 비슷한 날의 설정으로 맞춘다.
 * 무드등은 온도와 무관해 최근 기록으로 고르고, 카드 안에서 따로 묶어 보여 준다.
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

  // 열선·공조는 바뀔 때 알려 주는 차량 알림이 없다. 주행을 마치고 주차로 돌아오면 다시 읽어 "지금" 값을 맞춘다.
  const { refetch: rereadComfort } = comfort;
  useEffect(() => {
    if (vehicleConnected && parked) void rereadComfort();
  }, [vehicleConnected, parked, rereadComfort]);

  const state = comfort.data;
  const cabinNow = state?.cabinCurrent ?? null;
  const recommendation = records.data
    ? recommendComfort(records.data, cabinNow)
    : null;
  const changes: ComfortSettings =
    recommendation && state
      ? comfortChanges(state, recommendation.settings)
      : {};
  // 무드등은 켜짐·밝기·색이 함께 바뀌어도 한 곳으로 센다 (타일 하나).
  const ambientChanging = hasAmbient(changes);
  const changeCount =
    ROWS.filter(({ key }) => changes[key] !== undefined).length +
    (ambientChanging ? 1 : 0);
  const ambient =
    recommendation && hasAmbient(recommendation.settings)
      ? describeAmbient(recommendation.settings, changes, state)
      : null;

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

  // 화면이 떠 있는 동안 운전자가 차량 버튼으로 바꿨을 수 있다. 누른 순간의 차량 값을 다시 읽어 그때 다른 항목만 보낸다.
  const applyComfort = async () => {
    if (!recommendation) return;
    const fresh = (await rereadComfort()).data;
    if (!fresh) return;
    const latest = comfortChanges(fresh, recommendation.settings);
    if (Object.keys(latest).length === 0) return;
    apply.mutate(latest, {
      onSuccess: () => {
        setNotice("평소 설정으로 맞췄어요");
        void speakQuietly("평소 좋아하시는 설정으로 맞췄어요");
      },
    });
  };

  const basis = !recommendation
    ? null
    : `${
        recommendation.similarCabin && cabinNow !== null
          ? `지금 실내 ${describeTemp(Math.round(cabinNow))}와 비슷한 날의 설정이에요`
          : "최근 출발 기록으로 골랐어요"
      } · 기록 ${recommendation.basedOn}건`;

  // 제목 옆에는 기록 수 대신 "몇 곳이 달라지는지"를 보여 준다: 맞추기를 누를지 한눈에 고르게 한다.
  const count = !recommendation
    ? undefined
    : !state
      ? `기록 ${recommendation.basedOn}건`
      : changeCount > 0
        ? `${changeCount}곳이 달라요`
        : "평소와 같아요";

  return (
    <Card title="내 운전석 온도·무드등" count={count}>
      {records.isPending ? (
        <View style={styles.grid} accessibilityLabel="불러오는 중">
          {ROWS.map(({ key }) => (
            <View key={key} style={[styles.tile, styles.skeleton]} />
          ))}
        </View>
      ) : !recommendation ? (
        <AppText variant="secondary" tone="secondary">
          아직 기록이 없어요. 출발할 때의 열선·통풍·온도·바람·무드등부터
          자동으로 기억해요
        </AppText>
      ) : (
        <View style={styles.rows}>
          {basis ? (
            <AppText variant="caption" tone="tertiary">
              {basis}
            </AppText>
          ) : null}
          <View style={styles.grid}>
            {ROWS.map(({ key, label }) => {
              const wanted = recommendation.settings[key];
              if (wanted === undefined) return null;
              const value = describe(key, wanted, state);
              const detail = detailFor(key);
              // 바뀔 항목은 옅은 파랑 타일 + "지금 …" 글자로 함께 알린다 (색만으로 구분하지 않는다).
              const changing = changes[key] !== undefined;
              return (
                <View
                  key={key}
                  style={[styles.tile, changing && styles.tileChanging]}
                  accessible
                  accessibilityLabel={[label, value, detail]
                    .filter(Boolean)
                    .join(", ")}
                >
                  <AppText
                    variant="caption"
                    tone={changing ? "default" : "tertiary"}
                  >
                    {label}
                  </AppText>
                  <AppText variant="bodyStrong">{value}</AppText>
                  {detail ? (
                    <AppText
                      variant="caption"
                      tone={changing ? "default" : "tertiary"}
                    >
                      {detail}
                    </AppText>
                  ) : null}
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
          {ambient ? (
            <>
              <AppText variant="caption" tone="tertiary">
                무드등은 온도와 상관없이 최근 출발 기록으로 골랐어요
              </AppText>
              <View style={styles.grid}>
                <View
                  style={[styles.tile, ambientChanging && styles.tileChanging]}
                  accessible
                  accessibilityLabel={["무드등", ambient.value, ambient.detail]
                    .filter(Boolean)
                    .join(", ")}
                >
                  <AppText
                    variant="caption"
                    tone={ambientChanging ? "default" : "tertiary"}
                  >
                    무드등
                  </AppText>
                  <AppText variant="bodyStrong">{ambient.value}</AppText>
                  {ambient.detail ? (
                    <AppText variant="caption">{ambient.detail}</AppText>
                  ) : null}
                </View>
              </View>
            </>
          ) : null}
        </View>
      )}

      {/* 바꿀 것이 없으면 누를 수 없는 버튼 대신 상태 한 줄만 둔다. */}
      {canControlComfort && recommendation && vehicleConnected && state ? (
        changeCount === 0 ? (
          <AppText
            variant="secondary"
            tone="secondary"
            accessibilityLiveRegion="polite"
          >
            ✓ 지금 설정이 평소와 같아요
          </AppText>
        ) : (
          <View style={styles.action}>
            <Button
              label="평소 설정으로 맞추기"
              variant="secondary"
              onPress={() => void applyComfort()}
              disabled={!parked}
              loading={apply.isPending}
              accessibilityHint="열선과 통풍, 실내 온도, 바람, 무드등을 평소 설정으로 바꿔요"
            />
            {!parked ? (
              <AppText variant="caption" tone="tertiary">
                주차(P) 중에만 바꿔요
              </AppText>
            ) : null}
          </View>
        )
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
  rows: { gap: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    flexBasis: TILE_MIN_WIDTH,
    flexGrow: 1,
    minHeight: sizes.touchTarget,
    padding: spacing.sm,
    gap: spacing.xs,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  tileChanging: { backgroundColor: colors.primaryTint },
  // 실제 타일과 같은 크기의 빈 블록 (스켈레톤)
  skeleton: { minHeight: sizes.touchTarget + spacing.xl },
  action: { gap: spacing.xs, marginTop: spacing.sm },
}));
