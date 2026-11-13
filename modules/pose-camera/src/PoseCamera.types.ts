// 네이티브(Kotlin PoseCameraView.LANDMARK_NAMES)와 같은 이름·순서다. ML Kit Pose Detection 의 관절 33개.
export const POSE_LANDMARK_NAMES = [
  "nose",
  "leftEyeInner",
  "leftEye",
  "leftEyeOuter",
  "rightEyeInner",
  "rightEye",
  "rightEyeOuter",
  "leftEar",
  "rightEar",
  "leftMouth",
  "rightMouth",
  "leftShoulder",
  "rightShoulder",
  "leftElbow",
  "rightElbow",
  "leftWrist",
  "rightWrist",
  "leftPinky",
  "rightPinky",
  "leftIndex",
  "rightIndex",
  "leftThumb",
  "rightThumb",
  "leftHip",
  "rightHip",
  "leftKnee",
  "rightKnee",
  "leftAnkle",
  "rightAnkle",
  "leftHeel",
  "rightHeel",
  "leftFootIndex",
  "rightFootIndex",
] as const;

export type PoseLandmarkName = (typeof POSE_LANDMARK_NAMES)[number];

export type PoseLandmark = {
  name: PoseLandmarkName;
  /** 사람이 바로 선 방향으로 돌린 사진 기준 픽셀 좌표. 화면 밖으로 추정되면 범위를 벗어날 수 있다 */
  x: number;
  y: number;
  /** 이 관절이 사진 안에 보일 가능성 0~1 */
  likelihood: number;
};

/** 한 장에서 인식한 관절. 사진 자체는 넘어오지 않는다. 사람을 찾지 못하면 landmarks 가 비어 있다. */
export type PoseCapture = {
  width: number;
  height: number;
  landmarks: PoseLandmark[];
};

/** 화면 한 장에서 읽은 QR 코드. 사진은 넘어오지 않는다. 내용은 신뢰하지 않는 입력이다 (받는 쪽에서 검증한다). */
export type QrScan = {
  /** QR 에 적힌 글자. 화면에 QR 이 없거나 너무 길면 null */
  text: string | null;
  /** QR 은 있었지만 글자가 너무 길어 넘기지 않았다 */
  oversized: boolean;
};

export type CameraPermission = {
  granted: boolean;
  /** false 면 권한 창을 다시 띄울 수 없다 (차량 설정에서 바꿔야 한다) */
  canAskAgain: boolean;
};

export type PoseCameraErrorCode =
  | "ERR_CAMERA_PERMISSION"
  | "ERR_NO_CAMERA"
  | "ERR_CAMERA_FAILED"
  | "ERR_CAMERA_BUSY"
  | "ERR_CAMERA_TIMEOUT"
  | "ERR_POSE_FAILED"
  | "ERR_QR_FAILED";

export type PoseCameraReadyEvent = {
  /** 앱이 쓸 수 있는 카메라 수. 2 이상이면 cameraIndex 로 바꿀 수 있다 */
  cameraCount: number;
  cameraIndex: number;
  facing: "front" | "back" | "external";
};

export type PoseCameraErrorEvent = {
  code: PoseCameraErrorCode;
  message: string;
};

/** 주행 중 자세 관찰(PostureWatchService)이 몇 초마다 남기는 표본. 상반신 관절만 있다. */
export type PostureSample = PoseCapture & {
  /** 찍은 시각 (epoch ms) */
  at: number;
};

export type PostureWatchStatus = {
  running: boolean;
  /** 마지막으로 시작한 시각 (epoch ms). 시작한 적 없으면 0 */
  startedAt: number;
  sampleCount: number;
  lastSampleAt: number | null;
  error: PoseCameraErrorCode | null;
};
