import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

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

const COMFORT_REREAD_MS = 5000;

// 타일 최소 폭. 카드 폭을 재기 전(첫 그리기)에만 쓴다.
const TILE_MIN_WIDTH = 200;
// 카드 안쪽 폭이 이만큼이면 한 줄에 세 칸, 그보다 좁으면 두 칸, 아주 좁으면 한 칸.
const THREE_COLUMN_WIDTH = 640;
const TWO_COLUMN_WIDTH = 400;

type Tile = {
  id: string;
  label: string;
  value: string;
  detail?: string;
  changing: boolean;
  accessibilityLabel: string;
};

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
 * 무드등은 온도와 무관해 최근 기록으로 고르고, 타일 하나로 묶어 보여 준다.
 * 맞추기는 주차(P) 중 화면에서 운전자가 누를 때만 한다.
 * 한 화면에 들어오게 달라지는 곳만 먼저 보여 주고, 그대로인 곳은 한 줄로 접는다.
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
    // 열선·공조는 바뀔 때 알려 주는 차량 알림이 없다. 주차 중 카드가 떠 있는 동안에는 운전자가 차량 버튼으로
    // 바꾼 값이 "지금"에 보이도록 가끔 다시 읽는다 (주행 중에는 맞출 수 없으니 읽지 않는다).
    refetchInterval: parked ? COMFORT_REREAD_MS : false,
  });
  const apply = useApplyComfort();
  const [notice, setNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  // 타일을 같은 폭으로 나누려고 카드 안쪽 폭을 잰다 (넓으면 3칸, 좁으면 2칸).
  const [gridWidth, setGridWidth] = useState(0);

  // 주행을 마치고 주차로 돌아오면 기다리지 않고 바로 다시 읽는다.
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

  // 풍량·바람 방향은 자동 공조이거나 공조가 꺼져 있으면 건드리지 않는다. 그 이유를 타일과 카드 아래에 알린다.
  const fanHeld = state && !isFanManual(state) ? state.fanMode : undefined;
  const recommendsFan =
    recommendation?.settings.fanSpeed !== undefined ||
    recommendation?.settings.fanDirection !== undefined;

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
        void speakQuietly("평소 설정으로 맞췄어요");
      },
    });
  };

  const tiles: Tile[] = [];
  if (recommendation) {
    for (const { key, label } of ROWS) {
      const wanted = recommendation.settings[key];
      if (wanted === undefined) continue;
      const to = describe(key, wanted, state);
      const changing = changes[key] !== undefined;
      const now = state?.[key]?.value;
      if (state && isFanRow(key) && fanHeld && state[key]) {
        const detail = fanHeld === "auto" ? "지금 자동" : "지금 꺼짐";
        tiles.push({
          id: key,
          label,
          value: to,
          detail,
          changing,
          accessibilityLabel: `${label}, ${to}, ${detail}`,
        });
      } else if (changing && now !== undefined) {
        // 바뀔 곳은 옅은 파랑 타일 + "지금 값 → 바뀔 값" 글자로 함께 알린다 (색만으로 구분하지 않는다).
        const from = describe(key, now, state);
        tiles.push({
          id: key,
          label,
          value: `${from} → ${to}`,
          changing,
          accessibilityLabel: `${label}, 지금 ${from}, 맞추면 ${to}`,
        });
      } else {
        tiles.push({
          id: key,
          label,
          value: to,
          changing,
          accessibilityLabel: `${label}, ${to}`,
        });
      }
    }
    if (ambient)
      tiles.push({
        id: "ambient",
        label: "무드등",
        value: ambient.value,
        detail: ambient.detail,
        changing: ambientChanging,
        accessibilityLabel: ["무드등", ambient.value, ambient.detail]
          .filter(Boolean)
          .join(", "),
      });
  }
  // 지금 값을 모르면(차량 미연결) 비교할 수 없으니 접지 않고 평소 설정을 그대로 보여 준다.
  const changed = state ? tiles.filter((tile) => tile.changing) : tiles;
  const same = state ? tiles.filter((tile) => !tile.changing) : [];
  const showNotes = expanded || same.length === 0;

  // 고른 근거와 건드리지 않는 이유. 접힌 동안에는 숨겨 카드 높이를 줄인다.
  const notes = !recommendation
    ? []
    : [
        `${
          recommendation.similarCabin && cabinNow !== null
            ? `지금 실내 ${describeTemp(Math.round(cabinNow))}와 비슷한 날의 설정이에요`
            : "최근 출발 기록으로 골랐어요"
        } · 기록 ${recommendation.basedOn}건`,
        fanHeld && recommendsFan
          ? fanHeld === "auto"
            ? "자동 공조 중이라 풍량과 바람 방향은 그대로 둬요"
            : "공조가 꺼져 있어 풍량과 바람 방향은 그대로 둬요"
          : null,
        ambient ? "무드등은 온도와 상관없이 최근 출발 기록으로 골랐어요" : null,
      ].filter((note): note is string => note !== null);

  // 제목 옆에는 기록 수 대신 "몇 곳이 달라지는지"를 보여 준다: 맞추기를 누를지 한눈에 고르게 한다.
  const count = !recommendation
    ? undefined
    : !state
      ? `기록 ${recommendation.basedOn}건`
      : changeCount > 0
        ? `${changeCount}곳이 달라요`
        : "평소와 같아요";

  const columns =
    gridWidth >= THREE_COLUMN_WIDTH ? 3 : gridWidth >= TWO_COLUMN_WIDTH ? 2 : 1;
  const tileSize =
    gridWidth > 0
      ? {
          width: Math.floor((gridWidth - spacing.sm * (columns - 1)) / columns),
        }
      : styles.tileUnmeasured;

  const renderTile = (tile: Tile) => (
    <View
      key={tile.id}
      style={[styles.tile, tileSize, tile.changing && styles.tileChanging]}
      accessible
      accessibilityLabel={tile.accessibilityLabel}
    >
      <AppText variant="caption" tone={tile.changing ? "default" : "tertiary"}>
        {tile.label}
      </AppText>
      <AppText variant="bodyStrong">{tile.value}</AppText>
      {tile.detail ? (
        <AppText
          variant="caption"
          tone={tile.changing ? "default" : "tertiary"}
        >
          {tile.detail}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <Card title="평소 설정" count={count}>
      <View
        style={styles.body}
        onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
      >
        {records.isPending ? (
          <View style={styles.grid} accessibilityLabel="불러오는 중">
            {ROWS.slice(0, 3).map(({ key }) => (
              <View
                key={key}
                style={[styles.tile, tileSize, styles.skeleton]}
              />
            ))}
          </View>
        ) : !recommendation ? (
          <AppText variant="secondary" tone="secondary">
            아직 기록이 없어요. 출발할 때의 열선·통풍·온도·바람·무드등부터
            자동으로 기억해요
          </AppText>
        ) : (
          <>
            {changed.length > 0 ? (
              <View style={styles.grid}>{changed.map(renderTile)}</View>
            ) : null}
            {same.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`그대로인 곳 ${same.length}곳 ${expanded ? "접기" : "보기"}`}
                onPress={() => setExpanded((open) => !open)}
                style={({ pressed }) => [
                  styles.fold,
                  pressed && styles.foldPressed,
                ]}
              >
                <AppText variant="secondary" tone="secondary">
                  그대로인 곳 {same.length}곳 {expanded ? "접기" : "보기"}
                </AppText>
                <AppText variant="secondary" tone="tertiary">
                  {expanded ? "▴" : "▾"}
                </AppText>
              </Pressable>
            ) : null}
            {expanded && same.length > 0 ? (
              <View style={styles.grid}>{same.map(renderTile)}</View>
            ) : null}
            {showNotes
              ? notes.map((note) => (
                  <AppText key={note} variant="caption" tone="tertiary">
                    {note}
                  </AppText>
                ))
              : null}
          </>
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
            <>
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
            </>
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
      </View>
    </Card>
  );
}

const useStyles = themedStyles((colors) => ({
  // 카드 기본 간격(24)보다 촘촘하게 묶어 한 화면에 들어오게 한다.
  body: { gap: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    minHeight: sizes.touchTarget,
    padding: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  tileUnmeasured: { flexBasis: TILE_MIN_WIDTH, flexGrow: 1 },
  tileChanging: { backgroundColor: colors.primaryTint },
  // 실제 타일(이름 + 값 두 줄)과 같은 크기의 빈 블록 (스켈레톤)
  skeleton: { minHeight: sizes.touchTarget + spacing.lg },
  // 그대로인 곳을 펴고 접는 줄. 터치 대상 76dp.
  fold: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  foldPressed: { backgroundColor: colors.fill },
}));
