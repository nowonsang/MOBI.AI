// 네이티브(PleosConnectModule.kt)와 맞춘 JS 계약. 한쪽을 바꾸면 다른 쪽도 함께 바꾼다.

export type Gear = "park" | "reverse" | "neutral" | "drive" | "unknown";

/** 앞뒤(foreAft), 높이(height), 등받이 각도(backrest), 좌판 기울기(tilt) */
export type SeatAxis = "foreAft" | "height" | "backrest" | "tilt";

/** 차량이 알려 주는 원시 값. 단위는 차종마다 다르므로 min~max 비율로만 해석한다. */
export type SeatAxisState = {
  value: number;
  min: number;
  max: number;
  movable: boolean;
};

/** 차량이 지원하는 축만 들어 있다. */
export type DriverSeatState = Partial<Record<SeatAxis, SeatAxisState>>;

export type PleosErrorCode =
  | "ERR_NOT_AUTOMOTIVE"
  | "ERR_NOT_PARKED"
  | "ERR_SEAT_UNSUPPORTED"
  | "ERR_SEAT_MOVE_FAILED"
  /** 차량이 주행 중 제한으로 요청을 거부했다 (VehicleException ERROR_DRIVING_RESTRICTED) */
  | "ERR_DRIVING_RESTRICTED"
  /** 권한이 없거나 승인되지 않았다 (VehicleException ERROR_SECURITY_PERMISSION) */
  | "ERR_PERMISSION_DENIED"
  | "ERR_PLEOS_SERVICE";

/**
 * 플랫폼(CarUxRestrictions)이 지금 막고 있는 UX. Pleos 주행 규제 가이드는 이 값을 기준으로 화면을 줄이라고 한다.
 * noSetup: 시트·차량 설정 조작 금지 (UX_RESTRICTIONS_NO_SETUP)
 */
export type UxRestrictions = {
  requiresDistractionOptimization: boolean;
  noSetup: boolean;
};

export type PleosConnectEvents = {
  onGearChanged: (event: { gear: Gear }) => void;
  onUxRestrictionsChanged: (event: UxRestrictions) => void;
  onDriverSeatOccupancyChanged: (event: { occupied: boolean }) => void;
  onDestinationArrived: (event: Record<string, never>) => void;
  onSpeechPartial: (event: { text: string }) => void;
};
