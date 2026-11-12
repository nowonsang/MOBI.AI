import type {
  DriverComfortSettings,
  DriverComfortState,
} from "@/shared/pleos/pleos.types";

import type { ComfortRecord, ComfortSettings } from "./bodyfit.types";

// 저장할 수 있는 값의 범위. 차가 알려 준 값이라도 이 밖이면 그 항목만 빼고 기록한다.
/** 열선·통풍 단계 (차종마다 다르지만 이보다 넓은 차는 없다고 본다) */
export const HEAT_LEVEL_RANGE = { min: -10, max: 10 };
/** 공조 설정 온도(섭씨) */
export const CABIN_TARGET_RANGE = { min: 10, max: 40 };
/** 탈 때 실내 온도(섭씨). 한여름 햇볕 아래 세운 차 안은 80℃ 를 넘기도 한다. */
export const CABIN_TEMP_RANGE = { min: -40, max: 100 };

const within = (value: number, range: { min: number; max: number }) =>
  Number.isFinite(value) && value >= range.min && value <= range.max;

/** 탈 때 실내 온도가 이만큼(섭씨) 안이면 "비슷한 날"로 본다. */
export const SIMILAR_CABIN_GAP = 5;

/** 추천에 쓰는 최근 기록 수. 계절이 바뀌면 취향도 바뀌므로 최근 것만 본다. */
const RECENT_LIMIT = 5;

type ComfortKey = keyof ComfortSettings;
const COMFORT_KEYS: readonly ComfortKey[] = [
  "seatHeat",
  "steeringHeat",
  "cabinTarget",
];

/** 차량에서 읽은 상태 → 기록할 설정 값. 지원하지 않거나 범위를 벗어난 항목은 뺀다. */
export function toComfortSettings(state: DriverComfortState): ComfortSettings {
  const settings: ComfortSettings = {};
  for (const key of COMFORT_KEYS) {
    const value = state[key]?.value;
    if (value === undefined) continue;
    const valid =
      key === "cabinTarget"
        ? within(value, CABIN_TARGET_RANGE)
        : Number.isInteger(value) && within(value, HEAT_LEVEL_RANGE);
    if (valid) settings[key] = value;
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
 * 항목마다 최근 기록의 가운데 값(중앙값)을 쓴다: 한 번 다르게 켠 날에 흔들리지 않게 한다.
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
  for (const key of COMFORT_KEYS) {
    const values = picked
      .map((record) => record.settings[key])
      .filter((value): value is number => value !== undefined);
    if (values.length === 0) continue;
    const middle = median(values);
    // 열선은 정수 단계, 온도는 0.5도 단위로 맞춘다.
    settings[key] =
      key === "cabinTarget" ? Math.round(middle * 2) / 2 : Math.round(middle);
  }
  return {
    settings,
    basedOn: picked.length,
    similarCabin: similar.length > 0,
  };
}

/** 지금 차량 상태와 추천이 다른 항목만 남긴다. 다 같으면 빈 객체. 차량이 지원하지 않는 항목은 뺀다. */
export function comfortChanges(
  state: DriverComfortState,
  wanted: ComfortSettings,
): DriverComfortSettings {
  const changes: DriverComfortSettings = {};
  for (const key of COMFORT_KEYS) {
    const target = wanted[key];
    const item = state[key];
    if (target === undefined || !item) continue;
    const clamped = Math.min(item.max, Math.max(item.min, target));
    if (Math.abs(clamped - item.value) > 0.01) changes[key] = clamped;
  }
  return changes;
}
