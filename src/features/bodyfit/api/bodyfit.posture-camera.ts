import {
  drainPostureSamples,
  getCameraPermission,
  getPostureWatchStatus,
  isPoseCameraAvailable,
  requestCameraPermission,
  startPostureWatch,
  stopPostureWatch,
} from "@/shared/pose-camera/pose-camera";
import type { PostureSample } from "@/shared/pose-camera/pose-camera.types";

import { poseSampleSchema } from "../model/bodyfit.schema";

// C-7 주행 중 자세 관찰의 카메라 창구. 카메라는 차를 움직이지 않지만 개인정보라
// 운전자가 동의했고 카메라 권한이 있을 때만 켠다. 프레임은 네이티브 안에서 버려지고 관절 좌표만 온다.

/** 카메라가 있고 권한도 받았는지 (권한 창은 띄우지 않는다). */
export async function canWatchPosture(): Promise<boolean> {
  if (!isPoseCameraAvailable()) return false;
  return (await getCameraPermission()).granted;
}

/** 운전자가 동의를 켤 때 한 번 권한 창을 띄운다. 거부하면 false. */
export async function askPostureCamera(): Promise<boolean> {
  if (!isPoseCameraAvailable()) return false;
  return (await requestCameraPermission()).granted;
}

/**
 * 관찰을 켠다. 앱이 화면에 보이는 주차 중에만 부른다: 주행 중에는 화면이 가려져 Android 가 카메라 서비스 시작을 막는다.
 * 이미 켜져 있으면 그대로 둔다.
 */
export function ensurePostureWatch(): void {
  if (!getPostureWatchStatus().running) startPostureWatch();
}

export function stopPostureWatching(): void {
  if (getPostureWatchStatus().running) stopPostureWatch();
}

export function isPostureWatching(): boolean {
  return getPostureWatchStatus().running;
}

/** 모은 표본을 꺼낸다. 네이티브에서 온 값이라 형식이 틀린 표본은 버린다. */
export function takePostureSamples(): PostureSample[] {
  return drainPostureSamples().flatMap((sample) => {
    const parsed = poseSampleSchema.safeParse(sample);
    return parsed.success ? [parsed.data] : [];
  });
}
