import {
  POSE_LANDMARK_NAMES,
  type CameraPermission,
  type PoseCameraErrorCode,
  type PoseCameraReadyEvent,
  type PoseCapture,
  type PoseLandmark,
  type PoseLandmarkName,
  type PostureSample,
  type PostureWatchStatus,
} from "@modules/pose-camera/src/PoseCamera.types";

// 네이티브 모듈을 불러오지 않는 타입·상수. 순수 로직(model)과 테스트는 이 파일만 import 한다.
export { POSE_LANDMARK_NAMES };
export type {
  CameraPermission,
  PoseCameraErrorCode,
  PoseCameraReadyEvent,
  PoseCapture,
  PoseLandmark,
  PoseLandmarkName,
  PostureSample,
  PostureWatchStatus,
};
