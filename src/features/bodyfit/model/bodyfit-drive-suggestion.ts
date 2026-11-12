import { z } from "zod";

import {
  DEFAULT_DRIVE_CONTEXT,
  DRIVE_CONTEXT_LABEL,
} from "./bodyfit-drive-context";
import type { DriveContext } from "./bodyfit.types";

// C-5: 내비게이션 목적지까지 남은 거리·시간으로 운전 상황을 제안한다.
// 제안만 한다. 상황은 운전자가 눌러야 바뀐다. 거리·시간은 그 순간에만 쓰고 저장하지 않는다.

/** 장거리로 보는 예상 시간. 주행 후 질문(D-1)이 "오래 달렸다"고 보는 60분과 같게 둔다 */
export const LONG_DRIVE_MIN_SECONDS = 60 * 60;
/** 시간이 짧게 잡혀도(고속도로) 이 거리부터는 장거리로 본다 */
export const LONG_DRIVE_MIN_METERS = 80_000;
/** 시내로 보는 거리. 이보다 멀고 장거리보다 짧은 경로는 제안하지 않는다 (출퇴근인지 경로만으로는 알 수 없다) */
export const CITY_DRIVE_MAX_METERS = 20_000;

// 차량에서 온 값도 믿지 않는다: 형식이 다르거나 말이 안 되는 값(0 이하, 2,000km·48시간 초과)이면 제안하지 않는다.
const naviRouteSchema = z.object({
  remainDistance: z.number().int().positive().max(2_000_000),
  remainTime: z
    .number()
    .int()
    .nonnegative()
    .max(48 * 60 * 60),
});

export type DriveContextSuggestion = {
  /** 경로만으로 알 수 있는 상황만 제안한다 (출퇴근은 알 수 없다) */
  context: Extract<DriveContext, "long" | "city">;
  distanceMeters: number;
  durationSeconds: number;
};

/**
 * 목적지까지 남은 거리·시간으로 운전 상황을 제안한다. 제안할 것이 없으면 null.
 * 운전자가 이미 상황을 골랐으면(평소가 아니면) 제안하지 않는다: 고른 것을 다시 묻지 않는다.
 */
export function suggestDriveContext(
  route: unknown,
  current: DriveContext,
): DriveContextSuggestion | null {
  if (current !== DEFAULT_DRIVE_CONTEXT) return null;
  const parsed = naviRouteSchema.safeParse(route);
  if (!parsed.success) return null;
  const { remainDistance, remainTime } = parsed.data;
  const base = { distanceMeters: remainDistance, durationSeconds: remainTime };
  if (
    remainTime >= LONG_DRIVE_MIN_SECONDS ||
    remainDistance >= LONG_DRIVE_MIN_METERS
  ) {
    return { context: "long", ...base };
  }
  if (remainDistance <= CITY_DRIVE_MAX_METERS) {
    return { context: "city", ...base };
  }
  return null;
}

function formatDistance(meters: number): string {
  if (meters < 1_000) return "1km 안쪽";
  const km = meters / 1_000;
  // 10km 미만은 소수 한 자리까지, 그 이상은 한눈에 읽히게 정수로.
  return km < 10
    ? `${Math.round(km * 10) / 10}km`
    : `${Math.round(km).toLocaleString("ko-KR")}km`;
}

function formatDuration(seconds: number): string | null {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

/** 제안 문구 한 줄. 예: "목적지까지 120km, 1시간 30분쯤이에요. 장거리 자세로 볼까요?" */
export function describeDriveSuggestion(
  suggestion: DriveContextSuggestion,
): string {
  const distance = formatDistance(suggestion.distanceMeters);
  const duration = formatDuration(suggestion.durationSeconds);
  const route = duration
    ? `${distance}, ${duration}쯤이에요`
    : `${distance} 거리예요`;
  return `목적지까지 ${route}. ${DRIVE_CONTEXT_LABEL[suggestion.context]} 자세로 볼까요?`;
}
