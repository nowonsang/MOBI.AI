import { requireNativeView } from "expo";
import type { Ref } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import type {
  PoseCameraErrorEvent,
  PoseCameraReadyEvent,
  PoseCapture,
} from "./PoseCamera.types";

export type PoseCameraViewHandle = {
  /** 지금 보이는 화면 한 장에서 관절 위치만 뽑는다. 사진은 저장하지도 돌려주지도 않는다. */
  capturePose(): Promise<PoseCapture>;
};

export type PoseCameraViewProps = {
  /** 여러 카메라 중 몇 번째를 쓸지 (범위를 넘으면 처음으로 돌아간다) */
  cameraIndex?: number;
  onCameraReady?: (event: { nativeEvent: PoseCameraReadyEvent }) => void;
  onCameraError?: (event: { nativeEvent: PoseCameraErrorEvent }) => void;
  style?: StyleProp<ViewStyle>;
  ref?: Ref<PoseCameraViewHandle>;
};

// Kotlin PoseCameraView 와 1:1 이다. 화면에 붙으면 카메라를 켜고, 떨어지면 끈다.
export const PoseCameraView =
  requireNativeView<PoseCameraViewProps>("PoseCamera");
