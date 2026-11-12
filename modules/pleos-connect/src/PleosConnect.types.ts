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

/** 차량이 알려 주는 단계 값과 범위. 열선은 음수 = 통풍, 0 = 꺼짐, 양수 = 열선 단계다 (AAOS 규약). */
export type ComfortLevelState = { value: number; min: number; max: number };

/** 운전석 온도 취향. 차량이 지원하는 항목만 들어 있다. 온도는 섭씨. */
export type DriverComfortState = {
  seatHeat?: ComfortLevelState;
  steeringHeat?: ComfortLevelState;
  /** 운전석 공조 설정 온도 */
  cabinTarget?: ComfortLevelState;
  /** 지금 실내 온도 (외부 온도는 SDK 에 없다) */
  cabinCurrent?: number;
};

/** 바꿀 항목만 넣는다. 차량 범위 밖이면 범위 안으로 맞춰 보낸다. */
export type DriverComfortSettings = {
  seatHeat?: number;
  steeringHeat?: number;
  cabinTarget?: number;
};

export type PleosErrorCode =
  | "ERR_NOT_AUTOMOTIVE"
  | "ERR_NOT_PARKED"
  | "ERR_SEAT_UNSUPPORTED"
  | "ERR_SEAT_MOVE_FAILED"
  /** 차량이 주행 중 제한으로 요청을 거부했다 (VehicleException ERROR_DRIVING_RESTRICTED) */
  | "ERR_DRIVING_RESTRICTED"
  /** 권한이 없거나 승인되지 않았다 (VehicleException ERROR_SECURITY_PERMISSION) */
  | "ERR_PERMISSION_DENIED"
  | "ERR_PLEOS_SERVICE"
  /** 음성 인식 서비스에는 연결됐지만 정해진 시간 안에 말소리를 알아듣지 못했다 */
  | "ERR_NO_SPEECH";

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
  /** 운전석 한 축의 위치가 바뀌었다 (원시 값). 운전자가 시트 버튼을 누를 때도 온다. */
  onDriverSeatPositionChanged: (event: {
    axis: SeatAxis;
    value: number;
  }) => void;
  onDestinationArrived: (event: Record<string, never>) => void;
  onSpeechPartial: (event: { text: string }) => void;
};
