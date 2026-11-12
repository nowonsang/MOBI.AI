import { SEAT_AXES } from "@/shared/pleos/pleos.types";

import type { SeatAxis, SeatRatios } from "./bodyfit.types";

/**
 * 차량에 없는 경우가 흔한 축 (전동 좌판 연장·전동 헤드레스트·전동 안전벨트 높이).
 * 차량이 위치를 알려 줄 때만 추천·미리보기·안내에 넣는다. 나머지 네 축은 차량 값을 읽기 전에도 추천을 보여 준다.
 */
const OPTIONAL_AXES: ReadonlySet<SeatAxis> = new Set([
  "depth",
  "headrestHeight",
  "beltHeight",
]);

/**
 * 이 차량에서 보여 줄 추천만 남긴다. current 는 차량에서 읽은 자세(없으면 null).
 * 지원하지 않는 차량과 차량 밖(휴대폰 확인)에서는 기본 네 축만 남는다.
 */
export function recommendationForVehicle(
  recommended: SeatRatios,
  current: SeatRatios | null,
): SeatRatios {
  const shown: SeatRatios = {};
  for (const axis of SEAT_AXES) {
    const target = recommended[axis];
    if (target === undefined) continue;
    if (OPTIONAL_AXES.has(axis) && current?.[axis] === undefined) continue;
    shown[axis] = target;
  }
  return shown;
}

/** posture: 좌판·등받이로 잡는 앉은 자세, headBelt: 자세를 잡은 뒤 머리·어깨에 맞추는 것 */
export type SeatAxisGroupId = "posture" | "headBelt";

const GROUP_OF: Record<SeatAxis, SeatAxisGroupId> = {
  foreAft: "posture",
  height: "posture",
  backrest: "posture",
  tilt: "posture",
  depth: "posture",
  headrestHeight: "headBelt",
  beltHeight: "headBelt",
};

const GROUP_ORDER: readonly SeatAxisGroupId[] = ["posture", "headBelt"];

export type SeatAxisGroup<T> = { id: SeatAxisGroupId; items: T[] };

/**
 * 축이 일곱 개까지 늘어도 한눈에 읽히게 "자세 / 머리·벨트" 로 묶는다 (한 묶음은 다섯 개 이하).
 * 항목 순서는 그대로 두고, 항목이 없는 묶음은 만들지 않는다.
 */
export function groupSeatAxes<T extends { axis: SeatAxis }>(
  items: readonly T[],
): SeatAxisGroup<T>[] {
  return GROUP_ORDER.map((id) => ({
    id,
    items: items.filter((item) => GROUP_OF[item.axis] === id),
  })).filter((group) => group.items.length > 0);
}
