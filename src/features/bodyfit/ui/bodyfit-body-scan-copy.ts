import { poseCameraErrorCode } from "@/shared/pose-camera/pose-camera";

import type { BodyScanFailure } from "../model/bodyfit-body-scan";

type Copy = { title: string; description: string };

// 추정하지 못한 이유별 문구. 탓하지 않고, 바로 할 수 있는 행동을 알려 준다.
const FAILURE_COPY: Record<BodyScanFailure, Copy> = {
  heightMissing: {
    title: "키를 먼저 입력해 주세요",
    description: "키를 알아야 앉은키를 추정할 수 있어요",
  },
  invalidData: {
    title: "자세를 읽지 못했어요",
    description: "다시 찍거나 앉은키를 직접 입력해 주세요",
  },
  noPerson: {
    title: "사람을 찾지 못했어요",
    description: "머리부터 발끝까지 화면에 들어오게 서서 다시 찍어 주세요",
  },
  faceHidden: {
    title: "얼굴이 잘 보이지 않아요",
    description: "정면을 보고 밝은 곳에서 다시 찍어 주세요",
  },
  lowerBodyHidden: {
    title: "허리 아래가 보이지 않아요",
    description:
      "앉은 채로는 다리가 가려져 추정할 수 없어요. 발끝까지 보이게 서서 찍거나 직접 입력해 주세요",
  },
  notStanding: {
    title: "똑바로 선 자세가 아니에요",
    description: "정면을 보고 팔을 내린 채 똑바로 서서 다시 찍어 주세요",
  },
  tooSmall: {
    title: "너무 멀리 있어요",
    description: "조금 더 가까이 와 주세요",
  },
  implausible: {
    title: "자세가 제대로 잡히지 않았어요",
    description: "다시 찍거나 앉은키를 직접 입력해 주세요",
  },
};

export const describeBodyScanFailure = (reason: BodyScanFailure): Copy =>
  FAILURE_COPY[reason];

/** 카메라·자세 인식 자체가 실패했을 때 (네이티브 오류 코드별) */
export function describeBodyScanError(error: unknown): Copy {
  switch (poseCameraErrorCode(error)) {
    case "ERR_CAMERA_PERMISSION":
      return {
        title: "카메라 권한이 없어요",
        description:
          "차량 설정의 앱 권한에서 카메라를 허용하거나 앉은키를 직접 입력해 주세요",
      };
    case "ERR_NO_CAMERA":
      return {
        title: "이 차량에서는 카메라를 쓸 수 없어요",
        description: "앉은키를 직접 입력하거나 비워 두세요. 키로 추정해요",
      };
    case "ERR_CAMERA_BUSY":
      return {
        title: "아직 분석하는 중이에요",
        description: "잠시 후 다시 눌러 주세요",
      };
    case "ERR_CAMERA_TIMEOUT":
    case "ERR_CAMERA_FAILED":
      return {
        title: "카메라 화면을 받지 못했어요",
        description: "다시 시도하거나 앉은키를 직접 입력해 주세요",
      };
    default:
      return {
        title: "자세를 인식하지 못했어요",
        description: "다시 시도하거나 앉은키를 직접 입력해 주세요",
      };
  }
}
