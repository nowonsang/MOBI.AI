import { NativeModule, requireOptionalNativeModule } from "expo";

import type {
  CameraPermission,
  PostureSample,
  PostureWatchStatus,
} from "./PoseCamera.types";

declare class PoseCameraModule extends NativeModule {
  /** 앱이 열 수 있는 카메라가 하나라도 있는지 */
  hasCamera(): boolean;
  getCameraPermission(): Promise<CameraPermission>;
  /** 권한 창을 띄운다. 운전자가 "카메라로 재기"를 눌렀을 때만 부른다. */
  requestCameraPermission(): Promise<CameraPermission>;
  /** 주행 중 자세 관찰을 시작한다. 앱이 화면에 보일 때(주차 중)만 시작할 수 있다. */
  startPostureWatch(): void;
  stopPostureWatch(): void;
  getPostureWatchStatus(): PostureWatchStatus;
  /** 모은 표본을 넘기고 비운다 */
  drainPostureSamples(): PostureSample[];
}

// Expo Go·테스트처럼 네이티브 모듈이 없는 환경에서는 null 이다.
export const PoseCamera =
  requireOptionalNativeModule<PoseCameraModule>("PoseCamera");
