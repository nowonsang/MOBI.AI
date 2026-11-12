import { SEAT_AXES } from "@/shared/pleos/pleos.types";

import { LEARNED_ONLY_AXES } from "./bodyfit-recommend";
import type { SeatAxis, SeatRatios } from "./bodyfit.types";

/**
 * 차량에 없는 경우가 흔한 축 (전동 좌판 연장·전동 헤드레스트·전동 안전벨트 높이·전동 허리 지지대).
 * 차량이 위치를 알려 줄 때만 추천·미리보기·안내에 넣는다. 나머지 네 축은 차량 값을 읽기 전에도 추천을 보여 준다.
 */
const OPTIONAL_AXES: ReadonlySet<SeatAxis> = new Set([
  "depth",
  "headrestHeight",
  "beltHeight",
  ...LEARNED_ONLY_AXES,
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

/**
 * 기본 추천이 없는 축 가운데 이 차량에 있지만 아직 추천하지 못하는 축 (기록이 덜 쌓였다).
 * 화면이 "맞춰 두면 기억한다"고 알려 주는 데 쓴다.
 */
export function axesToRemember(
  recommended: SeatRatios,
  current: SeatRatios | null,
): SeatAxis[] {
  return LEARNED_ONLY_AXES.filter(
    (axis) => current?.[axis] !== undefined && recommended[axis] === undefined,
  );
}

/**
 * posture: 좌판·등받이로 잡는 앉은 자세, headBelt: 자세를 잡은 뒤 머리·어깨에 맞추는 것,
 * remembered: 체형 추천 없이 운전자가 맞춰 둔 값을 기억한 것 (허리 지지대·헤드레스트 각도)
 */
export type SeatAxisGroupId = "posture" | "headBelt" | "remembered";

const GROUP_OF: Record<SeatAxis, SeatAxisGroupId> = {
  foreAft: "posture",
  height: "posture",
  backrest: "posture",
  tilt: "posture",
  depth: "posture",
  headrestHeight: "headBelt",
  beltHeight: "headBelt",
  lumbar: "remembered",
  headrestAngle: "remembered",
};

const GROUP_ORDER: readonly SeatAxisGroupId[] = [
  "posture",
  "headBelt",
  "remembered",
];

export type SeatAxisGroup<T> = { id: SeatAxisGroupId; items: T[] };

/**
 * 축이 아홉 개까지 늘어도 한눈에 읽히게 "자세 / 머리·벨트 / 기억한 위치" 로 묶는다 (한 묶음은 다섯 개 이하).
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
