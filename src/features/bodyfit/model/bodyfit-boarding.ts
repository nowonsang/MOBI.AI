import type { Gear } from "@/shared/pleos/pleos.types";

/**
 * 운전석 착좌 값이 바뀌었는지. 처음 알게 된 값은 기준으로만 삼는다 (앱을 켜면 운전자 선택 화면부터 보인다).
 *
 * 앉음·일어남은 구분하지 않는다. Pleos Vehicle SDK 2.3.2 는 차량 값(VHAL SEAT_OCCUPANCY)이 1 일 때 "앉음"으로
 * 알려 주는데, Android 표준에서 1 은 빈 좌석(VACANT)이고 Pleos 에뮬레이터 Virtual Console 도 표준대로 보낸다
 * (2026-11-11 SDK 바이트코드·에뮬레이터로 확인). 실차가 어느 쪽인지 알 수 없어 "앉은 사람이 바뀌었을 수 있다"로만 쓴다.
 */
export function occupancyChanged(
  previous: boolean | null,
  occupied: boolean,
): boolean {
  return previous !== null && previous !== occupied;
}

/**
 * 운전자를 다시 고르게 할지 (A-4). 누가 앉았다면 선택 화면이 떠 있고, 누가 일어났다면 다음 사람을 위해 띄워 둔다.
 * 주차(P) 중일 때만 (S-5): 기어를 모르거나 P 가 아니면 착좌 값이 흔들려도 화면을 바꾸지 않는다.
 * 시트가 움직이는 중에도 바꾸지 않는다: 화면을 옮기면 "멈추기" 버튼이 가려진다.
 */
export function shouldReselectDriver({
  changed,
  gear,
  seatMoving,
}: {
  changed: boolean;
  gear: Gear | null;
  seatMoving: boolean;
}): boolean {
  return changed && gear === "park" && !seatMoving;
}
