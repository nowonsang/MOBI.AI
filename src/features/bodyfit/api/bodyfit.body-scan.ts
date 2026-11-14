import { useMutation } from "@tanstack/react-query";

import { canUseCamera, canUseDemoMode } from "@/shared/config/app-variant";
import { isPleosAvailable } from "@/shared/pleos/pleos";
import { useGear } from "@/shared/pleos/use-gear";
import {
  isPoseCameraAvailable,
  requestCameraPermission,
} from "@/shared/pose-camera/pose-camera";
import type { PoseCameraViewHandle } from "@/shared/pose-camera/pose-camera-view";

import {
  SAMPLE_POSE_CAPTURE,
  estimateSittingHeight,
  toPoseFigure,
  type BodyScanResult,
  type PoseFigure,
} from "../model/bodyfit-body-scan";

/**
 * 카메라로 재기를 어떤 방식으로 쓸 수 있는지.
 * camera: 실제 카메라로 찍는다. sample: 카메라가 없는 기기에서 샘플 자세 데이터로 흐름만 시연한다 (시연용 빌드).
 * null: 쓸 수 없다 (앱 마켓 빌드이거나, 카메라가 없는데 시연용 빌드도 아니다).
 */
export type BodyScanMode = "camera" | "sample";

export function bodyScanMode(): BodyScanMode | null {
  if (!canUseCamera) return null;
  if (isPoseCameraAvailable()) return "camera";
  return canUseDemoMode ? "sample" : null;
}

/** 카메라가 있어도 샘플 자세로 시연할 수 있는지 (에뮬레이터의 카메라 앞에 사람이 설 수 없을 때) */
export const canScanSample = canUseCamera && canUseDemoMode;

/**
 * 카메라로 재기는 주차(P) 중에만 쓴다. 기어를 아직 모르거나 확인할 수 없으면 주차가 아닌 것으로 본다.
 * 차량이 아닌 기기(휴대폰 확인용)에는 기어가 없으므로 막지 않는다.
 */
export function useParkedForBodyScan(): boolean {
  const gear = useGear();
  return isPleosAvailable() ? gear === "park" : true;
}

/** 카메라 권한 창을 띄운다. 운전자가 "카메라로 재기"를 눌렀을 때만 부른다. */
export function useRequestCameraPermission() {
  return useMutation({ mutationFn: requestCameraPermission });
}

export type BodyScanOutcome = {
  source: BodyScanMode;
  result: BodyScanResult;
  /** 사진 대신 보여 줄 뼈대. 사람을 찾지 못했으면 null */
  figure: PoseFigure | null;
};

type BodyScanRequest =
  | { source: "camera"; camera: PoseCameraViewHandle; heightCm: number }
  | { source: "sample"; heightCm: number };

/**
 * 화면 한 장의 관절 위치(또는 샘플 자세)로 앉은키를 추정한다. 저장하지 않는다:
 * 결과는 운전자가 확인한 뒤 입력 칸에 채워지고, 등록할 때 다른 체형 값과 함께 저장된다.
 * 사진은 네이티브에서 분석 직후 버려지고 여기에는 관절 좌표만 온다.
 */
export function useScanBody() {
  return useMutation({
    mutationFn: async (request: BodyScanRequest): Promise<BodyScanOutcome> => {
      const capture =
        request.source === "camera"
          ? await request.camera.capturePose()
          : SAMPLE_POSE_CAPTURE;
      return {
        source: request.source,
        result: estimateSittingHeight(capture, request.heightCm),
        figure: toPoseFigure(capture),
      };
    },
  });
}
