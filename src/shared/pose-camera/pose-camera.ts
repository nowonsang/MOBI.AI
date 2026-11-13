import { PoseCamera } from "@modules/pose-camera/src/PoseCameraModule";

import type {
  CameraPermission,
  PoseCameraErrorCode,
} from "./pose-camera.types";

// 카메라 + 기기 안 자세 인식 접근 창구. 앱 코드는 네이티브 모듈을 직접 import 하지 않고 여기를 거친다 (ESLint 로 강제).
// 카메라 프레임은 네이티브 안에서만 다루고 관절 좌표만 넘어온다 (modules/pose-camera).

/** 앱이 열 수 있는 카메라가 있는지. 네이티브 모듈이 없거나(테스트) 카메라가 없는 차량이면 false. */
export function isPoseCameraAvailable(): boolean {
  return PoseCamera?.hasCamera() ?? false;
}

const DENIED: CameraPermission = { granted: false, canAskAgain: false };

const toPermission = (response: CameraPermission): CameraPermission => ({
  granted: response.granted === true,
  canAskAgain: response.canAskAgain !== false,
});

export async function getCameraPermission(): Promise<CameraPermission> {
  if (!PoseCamera) return DENIED;
  return toPermission(await PoseCamera.getCameraPermission());
}

/** 권한 창을 띄운다. 운전자가 카메라 기능을 직접 눌렀을 때만 부른다. */
export async function requestCameraPermission(): Promise<CameraPermission> {
  if (!PoseCamera) return DENIED;
  return toPermission(await PoseCamera.requestCameraPermission());
}

const KNOWN_CODES: readonly PoseCameraErrorCode[] = [
  "ERR_CAMERA_PERMISSION",
  "ERR_NO_CAMERA",
  "ERR_CAMERA_FAILED",
  "ERR_CAMERA_BUSY",
  "ERR_CAMERA_TIMEOUT",
  "ERR_POSE_FAILED",
];

export function poseCameraErrorCode(error: unknown): PoseCameraErrorCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  return KNOWN_CODES.find((known) => known === code) ?? null;
}
