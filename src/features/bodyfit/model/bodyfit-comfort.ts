import type {
  DriverComfortSettings,
  DriverComfortState,
} from "@/shared/pleos/pleos.types";

import type {
  ComfortRecord,
  ComfortSettings,
  FanDirection,
} from "./bodyfit.types";

// 저장할 수 있는 값의 범위. 차가 알려 준 값이라도 이 밖이면 그 항목만 빼고 기록한다.
/** 열선 단계 (차종마다 다르지만 이보다 넓은 차는 없다고 본다). 음수는 냉각이다. */
export const HEAT_LEVEL_RANGE = { min: -10, max: 10 };
/** 시트 통풍 단계 (0 = 꺼짐) */
export const VENT_LEVEL_RANGE = { min: 0, max: 10 };
/** 풍량 단계 */
export const FAN_SPEED_RANGE = { min: 0, max: 20 };
/** 공조 설정 온도(섭씨) */
export const CABIN_TARGET_RANGE = { min: 10, max: 40 };
/** 탈 때 실내 온도(섭씨). 한여름 햇볕 아래 세운 차 안은 80℃ 를 넘기도 한다. */
export const CABIN_TEMP_RANGE = { min: -40, max: 100 };
/** 사이드미러 열선 단계 (0 = 꺼짐) */
export const MIRROR_HEAT_RANGE = { min: 0, max: 10 };
/** 무드등 밝기. 단계(1~10)로 주는 차도, 0~255 로 주는 차도 있다고 보고 넓게 잡는다. */
export const AMBIENT_BRIGHTNESS_RANGE = { min: 0, max: 255 };
/** 무드등 색. 차량이 주는 32비트 정수(색 번호나 RGB)를 뜻을 풀지 않고 그대로 둔다. */
export const AMBIENT_COLOR_RANGE = { min: -(2 ** 31), max: 2 ** 31 - 1 };

/** 기록·추천할 수 있는 바람 방향 */
export const FAN_DIRECTIONS = [
  "face",
  "floor",
  "faceFloor",
  "defrost",
  "faceDefrost",
  "floorDefrost",
  "faceFloorDefrost",
] as const satisfies readonly FanDirection[];

const within = (value: number, range: { min: number; max: number }) =>
  Number.isFinite(value) && value >= range.min && value <= range.max;

/** 탈 때 실내 온도가 이만큼(섭씨) 안이면 "비슷한 날"로 본다. */
export const SIMILAR_CABIN_GAP = 5;

/** 추천에 쓰는 최근 기록 수. 계절이 바뀌면 취향도 바뀌므로 최근 것만 본다. */
const RECENT_LIMIT = 5;

// 숫자 항목의 저장 범위와 단위: 열선·통풍·풍량은 정수 단계, 온도는 0.5도.
const LEVELS = {
  seatHeat: { range: HEAT_LEVEL_RANGE, step: 1 },
  seatVent: { range: VENT_LEVEL_RANGE, step: 1 },
  steeringHeat: { range: HEAT_LEVEL_RANGE, step: 1 },
  cabinTarget: { range: CABIN_TARGET_RANGE, step: 0.5 },
  fanSpeed: { range: FAN_SPEED_RANGE, step: 1 },
  // 사이드미러 열선도 추운 날·습한 날에 켜는 것이라 온도 항목과 같은 기준(실내 온도가 비슷한 날)으로 다룬다.
  mirrorHeat: { range: MIRROR_HEAT_RANGE, step: 1 },
} as const;
type LevelKey = keyof typeof LEVELS;
const LEVEL_KEYS = Object.keys(LEVELS) as LevelKey[];

/**
 * 풍량·바람 방향을 운전자가 직접 정하고 있는지.
 * 자동 공조이거나 공조가 꺼져 있으면 차가 정한 값이라 취향으로 기록하지 않고, 맞출 때도 건드리지 않는다
 * (수동 값을 보내면 자동이 풀리거나 공조가 켜진다).
 */
export const isFanManual = (state: DriverComfortState): boolean =>
  (state.fanMode ?? "manual") === "manual";

const isFanKey = (key: LevelKey) => key === "fanSpeed";

/** 차량에서 읽은 상태 → 기록할 설정 값. 지원하지 않거나 범위를 벗어난 항목은 뺀다. */
export function toComfortSettings(state: DriverComfortState): ComfortSettings {
  const settings: ComfortSettings = {};
  const fanManual = isFanManual(state);
  for (const key of LEVEL_KEYS) {
    const item = state[key];
    if (!item || (isFanKey(key) && !fanManual)) continue;
    const { range, step } = LEVELS[key];
    const valid =
      within(item.value, range) && (step !== 1 || Number.isInteger(item.value));
    // 풍량은 차량 범위 밖 값(공조가 꺼져 0 으로 읽히는 차)을 취향으로 남기지 않는다. 맞출 때 가장 약한 바람으로 켜지기 때문이다.
    const inVehicleRange = !isFanKey(key) || within(item.value, item);
    if (valid && inVehicleRange) settings[key] = item.value;
  }
  const direction = state.fanDirection?.value;
  if (fanManual && direction && FAN_DIRECTIONS.includes(direction))
    settings.fanDirection = direction;

  if (state.ambientOn !== undefined) settings.ambientOn = state.ambientOn;
  // 꺼 둔 날의 밝기·색은 고른 값이 아니라 남아 있던 값이라 취향으로 남기지 않는다.
  if (state.ambientOn !== false) {
    const brightness = state.ambientBrightness;
    if (
      brightness &&
      Number.isInteger(brightness.value) &&
      within(brightness.value, AMBIENT_BRIGHTNESS_RANGE) &&
      within(brightness.value, brightness)
    )
      settings.ambientBrightness = brightness.value;
    const color = state.ambientColor;
    if (
      color !== undefined &&
      Number.isInteger(color) &&
      within(color, AMBIENT_COLOR_RANGE)
    )
      settings.ambientColor = color;
  }
  return settings;
}

/** 출발할 때 읽은 상태 → 온도 취향 기록. 기록할 항목이 하나도 없으면 null. */
export function toComfortRecord(
  profileId: string,
  at: number,
  state: DriverComfortState,
): ComfortRecord | null {
  const settings = toComfortSettings(state);
  if (Object.keys(settings).length === 0) return null;
  const cabin = state.cabinCurrent;
  return {
    profileId,
    at,
    cabinTemp:
      cabin !== undefined && within(cabin, CABIN_TEMP_RANGE) ? cabin : null,
    settings,
  };
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** 가장 자주 고른 값. 횟수가 같으면 앞에 있는(최근) 값. */
const mostFrequent = <T>(values: readonly T[]): T | undefined => {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: T | undefined;
  for (const [value, count] of counts)
    if (best === undefined || count > (counts.get(best) ?? 0)) best = value;
  return best;
};

export type ComfortRecommendation = {
  settings: ComfortSettings;
  /** 추천에 쓴 기록 수 */
  basedOn: number;
  /** 지금 실내 온도와 비슷한 날의 기록으로 추천했는지 (false 면 최근 기록 기준) */
  similarCabin: boolean;
};

/**
 * 이 운전자의 출발 기록에서 지금 상황에 맞는 온도 취향을 고른다.
 * 지금 실내 온도를 알면 탈 때 온도가 비슷했던(±SIMILAR_CABIN_GAP) 기록만 보고, 없거나 모르면 최근 기록을 본다.
 * 숫자 항목은 최근 기록의 가운데 값(중앙값)을 쓴다: 한 번 다르게 켠 날에 흔들리지 않게 한다.
 * 바람 방향은 가장 자주 고른 방향을 쓴다.
 */
export function recommendComfort(
  records: readonly ComfortRecord[],
  cabinNow: number | null,
): ComfortRecommendation | null {
  if (records.length === 0) return null;
  const recent = [...records].sort((a, b) => b.at - a.at);
  const similar =
    cabinNow === null
      ? []
      : recent.filter(
          (record) =>
            record.cabinTemp !== null &&
            Math.abs(record.cabinTemp - cabinNow) <= SIMILAR_CABIN_GAP,
        );
  const picked = (similar.length > 0 ? similar : recent).slice(0, RECENT_LIMIT);

  const settings: ComfortSettings = {};
  for (const key of LEVEL_KEYS) {
    const values = picked
      .map((record) => record.settings[key])
      .filter((value): value is number => value !== undefined);
    if (values.length === 0) continue;
    const { step } = LEVELS[key];
    settings[key] = Math.round(median(values) / step) * step;
  }
  const direction = mostFrequent(
    picked
      .map((record) => record.settings.fanDirection)
      .filter((value): value is FanDirection => value !== undefined),
  );
  if (direction) settings.fanDirection = direction;

  // 열선과 통풍은 함께 켜지 않는다. 켠 날이 섞여 둘 다 추천되면 가장 최근에 켰던 쪽만 남긴다.
  if ((settings.seatHeat ?? 0) > 0 && (settings.seatVent ?? 0) > 0) {
    const latest = picked.find(
      ({ settings: s }) => (s.seatHeat ?? 0) > 0 || (s.seatVent ?? 0) > 0,
    );
    if ((latest?.settings.seatVent ?? 0) > 0) settings.seatHeat = 0;
    else settings.seatVent = 0;
  }

  // 무드등은 더위·추위와 상관없는 취향이다. 실내 온도로 거르면 계절이 바뀔 때마다 추천이 사라지므로 언제나 최근 기록에서 고른다.
  // 켜짐·색은 숫자의 가운데 값이 뜻이 없어 가장 자주 고른 값을, 밝기는 가운데 값을 쓴다.
  const lights = recent.slice(0, RECENT_LIMIT).map((record) => record.settings);
  const defined = <T>(values: readonly (T | undefined)[]) =>
    values.filter((value): value is T => value !== undefined);
  const on = mostFrequent(defined(lights.map((s) => s.ambientOn)));
  if (on !== undefined) settings.ambientOn = on;
  // 평소 꺼 두는 운전자에게는 밝기·색을 추천하지 않는다.
  if (on !== false) {
    const brightness = defined(lights.map((s) => s.ambientBrightness));
    if (brightness.length > 0)
      settings.ambientBrightness = Math.round(median(brightness));
    const color = mostFrequent(defined(lights.map((s) => s.ambientColor)));
    if (color !== undefined) settings.ambientColor = color;
  }
  return {
    settings,
    basedOn: picked.length,
    similarCabin: similar.length > 0,
  };
}

/**
 * 지금 차량 상태와 추천이 다른 항목만 남긴다. 다 같으면 빈 객체. 차량이 지원하지 않는 항목은 뺀다.
 * 풍량·바람 방향은 운전자가 직접 정하고 있을 때만 바꾼다 (isFanManual).
 */
export function comfortChanges(
  state: DriverComfortState,
  wanted: ComfortSettings,
): DriverComfortSettings {
  const changes: DriverComfortSettings = {};
  const fanManual = isFanManual(state);
  for (const key of LEVEL_KEYS) {
    const target = wanted[key];
    const item = state[key];
    if (target === undefined || !item) continue;
    if (isFanKey(key) && !fanManual) continue;
    const clamped = Math.min(item.max, Math.max(item.min, target));
    if (Math.abs(clamped - item.value) > 0.01) changes[key] = clamped;
  }
  const direction = wanted.fanDirection;
  const now = state.fanDirection;
  if (
    fanManual &&
    direction &&
    now &&
    direction !== now.value &&
    now.options.includes(direction)
  )
    changes.fanDirection = direction;

  if (
    wanted.ambientOn !== undefined &&
    state.ambientOn !== undefined &&
    wanted.ambientOn !== state.ambientOn
  )
    changes.ambientOn = wanted.ambientOn;
  // 끄는 것으로 맞출 때와 꺼진 채 둘 때는 밝기·색을 건드리지 않는다.
  if ((wanted.ambientOn ?? state.ambientOn) !== false) {
    const brightness = state.ambientBrightness;
    if (wanted.ambientBrightness !== undefined && brightness) {
      const clamped = Math.min(
        brightness.max,
        Math.max(brightness.min, wanted.ambientBrightness),
      );
      if (clamped !== brightness.value) changes.ambientBrightness = clamped;
    }
    if (
      wanted.ambientColor !== undefined &&
      state.ambientColor !== undefined &&
      wanted.ambientColor !== state.ambientColor
    )
      changes.ambientColor = wanted.ambientColor;
  }
  return changes;
}

/** 무드등 항목 (온도 항목과 추천 기준이 달라 화면에서 따로 묶는다) */
export const AMBIENT_KEYS = [
  "ambientOn",
  "ambientBrightness",
  "ambientColor",
] as const satisfies readonly (keyof ComfortSettings)[];

/** 무드등 추천이나 바꿀 항목이 하나라도 있는지 */
export const hasAmbient = (settings: ComfortSettings): boolean =>
  AMBIENT_KEYS.some((key) => settings[key] !== undefined);
