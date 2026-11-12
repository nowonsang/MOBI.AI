// 네이티브(PleosConnectModule.kt)와 맞춘 JS 계약. 한쪽을 바꾸면 다른 쪽도 함께 바꾼다.

export type Gear = "park" | "reverse" | "neutral" | "drive" | "unknown";

/**
 * 앞뒤(foreAft), 높이(height), 등받이 각도(backrest), 좌판 기울기(tilt),
 * 좌판 길이(depth), 헤드레스트 높이(headrestHeight), 안전벨트 높이(beltHeight),
 * 허리 지지대 앞뒤(lumbar), 헤드레스트 각도(headrestAngle)
 */
export type SeatAxis =
  | "foreAft"
  | "height"
  | "backrest"
  | "tilt"
  | "depth"
  | "headrestHeight"
  | "beltHeight"
  | "lumbar"
  | "headrestAngle";

/** 차량이 알려 주는 원시 값. 단위는 차종마다 다르므로 min~max 비율로만 해석한다. */
export type SeatAxisState = {
  value: number;
  min: number;
  max: number;
  movable: boolean;
};

/** 차량이 지원하는 축만 들어 있다. */
export type DriverSeatState = Partial<Record<SeatAxis, SeatAxisState>>;

/** 차량이 알려 주는 단계 값과 범위. 시트 열선은 음수 = 냉각, 0 = 꺼짐, 양수 = 열선 단계다 (AAOS 규약). 통풍은 seatVent 로 따로 온다. */
export type ComfortLevelState = { value: number; min: number; max: number };

/** 바람이 나오는 곳 (SDK FanDirectionType). face = 얼굴, floor = 발, defrost = 앞유리 */
export type FanDirection =
  | "face"
  | "floor"
  | "faceFloor"
  | "defrost"
  | "faceDefrost"
  | "floorDefrost"
  | "faceFloorDefrost";

/** 운전석 온도 취향. 차량이 지원하는 항목만 들어 있다. 온도는 섭씨. */
export type DriverComfortState = {
  seatHeat?: ComfortLevelState;
  /** 시트 통풍 단계 (0 = 꺼짐). 열선과 별개 값이다 */
  seatVent?: ComfortLevelState;
  steeringHeat?: ComfortLevelState;
  /** 운전석 공조 설정 온도 */
  cabinTarget?: ComfortLevelState;
  /** 지금 실내 온도 (외부 온도는 SDK 에 없다) */
  cabinCurrent?: number;
  /** 풍량 단계 */
  fanSpeed?: ComfortLevelState;
  /** 바람 방향과 이 차량에서 고를 수 있는 방향 */
  fanDirection?: { value: FanDirection; options: FanDirection[] };
  /** 풍량·바람 방향을 지금 누가 정하는지. auto(자동 공조)·off(공조 꺼짐)면 차가 정한 값이라 기록하지도 바꾸지도 않는다 */
  fanMode?: "manual" | "auto" | "off";
  /** 사이드미러 열선 단계 (0 = 꺼짐) */
  mirrorHeat?: ComfortLevelState;
  /** 무드등이 켜져 있는지. 자동처럼 켜짐·꺼짐이 아닌 상태면 없다 */
  ambientOn?: boolean;
  ambientBrightness?: ComfortLevelState;
  /** 무드등 색. 차량이 주는 정수 값이며 뜻은 차종마다 달라 그대로 되돌려 보내기만 한다 */
  ambientColor?: number;
};

/** 바꿀 항목만 넣는다. 차량 범위 밖이면 범위 안으로 맞춰 보낸다. 풍량·바람 방향은 fanMode 가 manual 일 때만 바뀐다. */
export type DriverComfortSettings = {
  seatHeat?: number;
  seatVent?: number;
  steeringHeat?: number;
  cabinTarget?: number;
  fanSpeed?: number;
  fanDirection?: FanDirection;
  mirrorHeat?: number;
  ambientOn?: boolean;
  ambientBrightness?: number;
  ambientColor?: number;
};

/**
 * 내비게이션 목적지까지 남은 거리·시간 (NaviHelper DestinationInfo 의 원시 값).
 * SDK 문서에 단위가 없어 미터·초로 본다. 좌표·이름·주소는 넘어오지 않는다.
 */
export type NaviRoute = { remainDistance: number; remainTime: number };

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
