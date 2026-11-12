import type { FanDirection, SeatAxis } from "@/shared/pleos/pleos.types";

export type { FanDirection, SeatAxis };

export type BodyProfile = {
  id: string;
  name: string;
  heightCm: number;
  weightKg: number;
  /** 앉은키. 모르면 키로 추정한다. */
  sittingHeightCm: number | null;
  /** 음성 기능 선택 동의. 음성은 Pleos 음성 인식 서버에서 처리될 수 있다. */
  voiceConsent: boolean;
  createdAt: number;
  /** 체형 정보 수집·이용 필수 동의 시각. 등록 버튼("동의하고 등록하기")을 누른 때다. */
  consentedAt: number;
};

export type BodyProfileInput = Omit<
  BodyProfile,
  "id" | "createdAt" | "consentedAt"
>;

/**
 * 축별 위치를 차량이 지원하는 범위 안의 비율(0 = 최소, 1 = 최대)로 나타낸다.
 * 차종마다 원시 값의 단위가 달라서 저장·학습은 비율로만 한다.
 * foreAft 1 = 가장 앞, height 1 = 가장 높게, backrest 1 = 가장 세움, tilt 1 = 좌판 앞쪽 가장 높게.
 * depth 1 = 좌판 가장 길게, headrestHeight 1 = 가장 높게, beltHeight 1 = 가장 높게.
 * lumbar 1 = 허리 지지대 가장 앞으로(가장 많이 받침), headrestAngle 1 = 헤드레스트 가장 앞으로 세움.
 */
export type SeatRatios = Partial<Record<SeatAxis, number>>;

/**
 * 운전 상황 (C-5). 운전자가 주차 중에 고르고, 고르지 않으면 평소(usual)다.
 * 자세 기록에 함께 남겨 같은 상황의 기록으로 추천을 보정한다.
 */
export type DriveContext = "usual" | "commute" | "long" | "city";

/**
 * drive-start: 주행을 시작할 때의 자세, saved: 직접 저장한 자세,
 * touch: 주행 후 터치 피드백(지금 자세 + 고른 방향, 시트는 움직이지 않음), voice: 음성 피드백으로 조절한 자세
 */
export type SeatAdjustmentSource = "drive-start" | "voice" | "saved" | "touch";

/** 체형만으로 계산한 기본 추천(baseline)과 운전자가 최종으로 받아들인 자세(final). 개인 보정의 학습 데이터다. */
export type SeatAdjustment = {
  profileId: string;
  at: number;
  baseline: SeatRatios;
  final: SeatRatios;
  source: SeatAdjustmentSource;
  /** 이 자세로 앉았을 때의 운전 상황. 상황이 생기기 전에 저장된 기록은 평소로 읽는다 */
  context: DriveContext;
};

/**
 * 진행 중인 주행: 누가 언제 출발했는지. 주행 후 질문(D-1)의 기준이다.
 * 기어가 P 에서 벗어나면 차량이 앱을 종료할 수 있어 메모리가 아니라 기기에 남긴다.
 */
export type DriveSession = {
  profileId: string;
  startedAt: number;
  /** 출발할 때 고른 운전 상황. 주행 후 피드백(D-2)을 같은 상황의 기록으로 남긴다 */
  context: DriveContext;
};

/** increase/decrease 의 뜻은 SeatRatios 의 축 방향을 따른다. */
export type SeatNudge = {
  axis: SeatAxis;
  direction: "increase" | "decrease";
  amount: "small" | "medium";
};

export type FeedbackInterpretation = {
  nudges: SeatNudge[];
  /** 운전자에게 보여 주고 들려줄 해요체 한 문장 */
  reply: string;
};

/** 운전석 온도 취향 (열선·통풍·풍량은 차량 단계 값, 공조 설정 온도는 섭씨). 차량이 지원하는 항목만 있다. */
export type ComfortSettings = {
  seatHeat?: number;
  /** 시트 통풍 단계 (0 = 꺼짐) */
  seatVent?: number;
  steeringHeat?: number;
  cabinTarget?: number;
  /** 풍량·바람 방향은 운전자가 직접 맞춘 날만 남긴다 (자동 공조·공조 꺼짐은 차가 정한 값이라 뺀다) */
  fanSpeed?: number;
  fanDirection?: FanDirection;
  /** 사이드미러 열선 단계 (0 = 꺼짐) */
  mirrorHeat?: number;
  /** 무드등. 온도와 무관한 취향이라 실내 온도가 아닌 최근 기록으로 추천한다. 꺼 둔 날은 밝기·색을 남기지 않는다 */
  ambientOn?: boolean;
  ambientBrightness?: number;
  /** 차량이 준 색 값 그대로 (뜻은 차종마다 다르다) */
  ambientColor?: number;
};

/** 출발할 때의 온도 취향 기록. cabinTemp(탈 때 실내 온도)가 비슷한 기록끼리 묶어 다음 추천에 쓴다. */
export type ComfortRecord = {
  profileId: string;
  at: number;
  /** 탈 때 실내 온도(섭씨). 차량이 알려 주지 않으면 null */
  cabinTemp: number | null;
  settings: ComfortSettings;
};
