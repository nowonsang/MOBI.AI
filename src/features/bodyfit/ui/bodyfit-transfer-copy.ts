import { poseCameraErrorCode } from "@/shared/pose-camera/pose-camera";

import type { TransferReadFailure } from "../api/bodyfit.transfer";
import { DRIVE_CONTEXT_LABEL } from "../model/bodyfit-drive-context";
import {
  transferRecordCount,
  type PostureTransfer,
} from "../model/bodyfit-transfer";

type Copy = { title: string; description: string };

// 가져오지 않은 이유별 문구. 무슨 일이 생겼고 어떻게 하면 되는지를 함께 알린다.
const FAILURE_COPY: Record<TransferReadFailure, Copy> = {
  notFound: {
    title: "QR 코드를 찾지 못했어요",
    description:
      "휴대폰 화면을 밝게 하고, 코드가 카메라 화면 가운데에 크게 보이게 비춰 주세요",
  },
  notBodyfit: {
    title: "BodyFit 코드가 아니에요",
    description:
      "원래 차의 BodyFit 에서 '다른 차로 가져가기'로 만든 코드를 비춰 주세요",
  },
  tooLarge: {
    title: "BodyFit 코드가 아니에요",
    description:
      "코드에 담긴 내용이 너무 커서 읽지 않았어요. '다른 차로 가져가기'로 만든 코드를 비춰 주세요",
  },
  version: {
    title: "버전이 다른 코드예요",
    description:
      "코드를 만든 차와 이 차의 앱 버전이 달라 가져오지 않았어요. 앱 버전을 맞춘 뒤 코드를 다시 만들어 주세요",
  },
  malformed: {
    title: "코드를 끝까지 읽지 못했어요",
    description:
      "코드가 잘렸거나 손상돼 가져오지 않았어요. 원래 차에서 코드를 다시 찍어 와 주세요",
  },
  outOfRange: {
    title: "코드에 맞지 않는 값이 있어요",
    description:
      "안전을 위해 가져오지 않았어요. 원래 차에서 코드를 다시 만들거나 운전자를 직접 등록해 주세요",
  },
};

export const describeTransferFailure = (reason: TransferReadFailure): Copy =>
  FAILURE_COPY[reason];

/** 카메라·QR 인식 자체가 실패했을 때 (네이티브 오류 코드별). 직접 등록이 언제나 대안이다. */
export function describeTransferCameraError(error: unknown): Copy {
  switch (poseCameraErrorCode(error)) {
    case "ERR_CAMERA_PERMISSION":
      return {
        title: "카메라 권한이 없어요",
        description:
          "차량 설정의 앱 권한에서 카메라를 허용하거나 운전자를 직접 등록해 주세요",
      };
    case "ERR_NO_CAMERA":
      return {
        title: "이 차량에서는 카메라를 쓸 수 없어요",
        description: "운전자를 직접 등록해 주세요",
      };
    default:
      return {
        title: "카메라로 코드를 읽지 못했어요",
        description: "다시 시도하거나 운전자를 직접 등록해 주세요",
      };
  }
}

/** "키 172cm · 몸무게 68kg" */
export const describeTransferBody = (transfer: PostureTransfer): string =>
  `키 ${transfer.heightCm}cm · 몸무게 ${transfer.weightKg}kg`;

export const describeTransferSittingHeight = (
  transfer: PostureTransfer,
): string =>
  transfer.sittingHeightCm === null
    ? "앉은키는 키로 추정해요"
    : `앉은키 ${transfer.sittingHeightCm}cm`;

/** 학습 요약 한 줄과 상황별 내역 ("평소 5건 · 장거리 2건"). 기록이 없으면 내역이 없다. */
export function describeTransferLearning(transfer: PostureTransfer): {
  value: string;
  detail: string;
} {
  const count = transferRecordCount(transfer);
  if (count === 0) {
    return {
      value: "학습 기록이 아직 없어요",
      detail: "체형으로 계산한 자세부터 시작해요",
    };
  }
  return {
    value: `학습 기록 ${count}건 반영`,
    detail: transfer.learning
      .map((item) => `${DRIVE_CONTEXT_LABEL[item.context]} ${item.count}건`)
      .join(" · "),
  };
}
