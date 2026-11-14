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
  SAMPLE_TRANSFER_CODE,
  decodeTransfer,
  type PostureTransfer,
  type TransferFailure,
} from "../model/bodyfit-transfer";

/**
 * 다른 차로 내 자세 가져가기 (A-7) 를 쓸 수 있는 빌드인지.
 * 가져오기에 카메라 권한이 필요해 앱 마켓 빌드에서는 뺀다. 읽을 수 있는 빌드가 없으면 코드를 만들 이유도 없어
 * 내보내기도 함께 숨긴다.
 */
export const canTransferProfile = canUseCamera;

/**
 * QR 을 어떻게 읽을 수 있는지.
 * camera: 실제 카메라로 읽는다. sample: 카메라가 없는 기기에서 샘플 코드로 흐름만 시연한다 (시연용 빌드).
 * null: 쓸 수 없다.
 */
export type TransferReadMode = "camera" | "sample";

export function transferReadMode(): TransferReadMode | null {
  if (!canTransferProfile) return null;
  if (isPoseCameraAvailable()) return "camera";
  return canUseDemoMode ? "sample" : null;
}

/**
 * 카메라로 읽기는 주차(P) 중에만 쓴다. 기어를 아직 모르거나 확인할 수 없으면 주차가 아닌 것으로 본다.
 * 차량이 아닌 기기(휴대폰 확인용)에는 기어가 없으므로 막지 않는다.
 */
export function useParkedForCamera(): boolean {
  const gear = useGear();
  return isPleosAvailable() ? gear === "park" : true;
}

/** 카메라 권한 창을 띄운다. 운전자가 카메라를 쓰는 버튼·동의를 눌렀을 때만 부른다. */
export function useRequestCameraPermission() {
  return useMutation({ mutationFn: requestCameraPermission });
}

/** 카메라가 있어도 샘플 코드로 시연할 수 있는지 (에뮬레이터의 모의 카메라에는 QR 을 비출 수 없다) */
export const canReadSampleTransfer = canTransferProfile && canUseDemoMode;

// 화면 한 장을 읽고 QR 이 없으면 이만큼 쉬었다가 다시 읽는다.
const READ_INTERVAL_MS = 250;
// 이 시간 안에 찾지 못하면 멈추고 알린다 (카메라를 계속 켜 두지 않는다).
const READ_TIMEOUT_MS = 30_000;

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** notFound: 시간 안에 QR 을 찾지 못했다. 나머지는 읽은 코드를 받지 않은 이유다 (model 의 TransferFailure). */
export type TransferReadFailure = TransferFailure | "notFound";

export type TransferReadOutcome = { source: TransferReadMode } & (
  | { ok: true; transfer: PostureTransfer }
  | { ok: false; reason: TransferReadFailure }
);

type TransferReadRequest =
  | {
      source: "camera";
      camera: PoseCameraViewHandle;
      /** 화면을 떠났거나 카메라를 바꿨으면 참. 다음 장을 읽지 않고 끝낸다 */
      isCancelled: () => boolean;
    }
  | { source: "sample" };

/**
 * QR 코드를 찾을 때까지 화면을 한 장씩 읽고, 찾으면 내용을 검증한다 (또는 샘플 코드를 같은 검증에 넣는다).
 * 여기서는 아무것도 저장하지 않는다: 결과를 미리보기로 보여 주고 운전자가 확인한 뒤 useImportBodyProfile 로 저장한다.
 * 사진은 네이티브에서 분석 직후 버려지고 여기에는 QR 에 적힌 글자만 온다. 그 글자도 검증에만 쓰고 남기지 않는다.
 */
export function useReadTransferCode() {
  return useMutation({
    mutationFn: async (
      request: TransferReadRequest,
    ): Promise<TransferReadOutcome> => {
      if (request.source === "sample") {
        return { source: "sample", ...decodeTransfer(SAMPLE_TRANSFER_CODE) };
      }
      const deadline = Date.now() + READ_TIMEOUT_MS;
      while (!request.isCancelled() && Date.now() < deadline) {
        const scan = await request.camera.scanQrCode();
        if (scan.oversized) {
          return { source: "camera", ok: false, reason: "tooLarge" };
        }
        if (scan.text !== null) {
          return { source: "camera", ...decodeTransfer(scan.text) };
        }
        await wait(READ_INTERVAL_MS);
      }
      return { source: "camera", ok: false, reason: "notFound" };
    },
  });
}
