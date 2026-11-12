import type {
  ComfortLevelState,
  DriverComfortSettings,
  DriverComfortState,
  DriverSeatState,
  Gear,
  PleosConnectEvents,
  PleosErrorCode,
  SeatAxis,
  SeatAxisState,
  UxRestrictions,
} from "@modules/pleos-connect/src/PleosConnect.types";

// 네이티브 모듈을 불러오지 않는 타입·상수. 순수 로직(model)과 테스트는 이 파일만 import 한다.
export type {
  ComfortLevelState,
  DriverComfortSettings,
  DriverComfortState,
  DriverSeatState,
  Gear,
  PleosConnectEvents,
  PleosErrorCode,
  SeatAxis,
  SeatAxisState,
  UxRestrictions,
};

export const SEAT_AXES: readonly SeatAxis[] = [
  "foreAft",
  "height",
  "backrest",
  "tilt",
];
