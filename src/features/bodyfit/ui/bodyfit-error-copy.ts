import { pleosErrorCode } from "@/shared/pleos/pleos";

type Copy = { title: string; description: string };

/** 열선·공조 맞추기 실패. 시트와 달리 직접 맞추는 대안은 차량의 공조 버튼이다. */
export function describeComfortError(error: unknown): Copy {
  switch (pleosErrorCode(error)) {
    case "ERR_NOT_PARKED":
      return {
        title: "주차 중에만 온도를 맞춰요",
        description: "기어를 P로 바꾼 뒤 다시 눌러 주세요",
      };
    case "ERR_PERMISSION_DENIED":
      return {
        title: "이 차량에서는 아직 쓸 수 없는 기능이에요",
        description: "열선과 온도는 차량의 공조 버튼으로 맞춰 주세요",
      };
    case "ERR_NOT_AUTOMOTIVE":
    case "ERR_DRIVING_RESTRICTED":
      return describeBodyfitError(error);
    default:
      return {
        title: "온도를 맞추지 못했어요",
        description: "잠시 후 다시 시도하거나 차량의 공조 버튼으로 맞춰 주세요",
      };
  }
}

// 같은 실패는 어디서나 같은 문구로 보여 준다. 탓하지 않고, 바로 할 수 있는 행동을 알려 준다.
export function describeBodyfitError(error: unknown): Copy {
  switch (pleosErrorCode(error)) {
    case "ERR_NOT_AUTOMOTIVE":
      return {
        title: "차량에 연결되어 있지 않아요",
        description: "Pleos Connect 에뮬레이터나 차량에서 앱을 열어 주세요",
      };
    case "ERR_NOT_PARKED":
      return {
        title: "주차 중에만 시트를 움직여요",
        description: "기어를 P로 바꾼 뒤 다시 눌러 주세요",
      };
    case "ERR_SEAT_UNSUPPORTED":
      return {
        title: "이 차량은 시트 자동 조절을 지원하지 않아요",
        description:
          "'안내 받으며 맞추기'로 시트 버튼을 직접 움직여 맞춰 주세요",
      };
    case "ERR_SEAT_MOVE_FAILED":
      return {
        title: "시트를 끝까지 맞추지 못했어요",
        description:
          "시트 주변에 걸리는 물건이 없는지 확인하고 다시 시도해 주세요",
      };
    case "ERR_DRIVING_RESTRICTED":
      return {
        title: "주행 중에는 할 수 없어요",
        description: "차를 세운 뒤 다시 시도해 주세요",
      };
    case "ERR_PERMISSION_DENIED":
      return {
        title: "이 차량에서는 아직 쓸 수 없는 기능이에요",
        description:
          "'안내 받으며 맞추기'로 시트 버튼을 직접 움직여 맞춰 주세요",
      };
    case "ERR_NO_SPEECH":
      return {
        title: "잘 듣지 못했어요",
        description: "'말로 알려 주기'를 누르고 다시 말해 주세요",
      };
    case "ERR_PLEOS_SERVICE":
      return {
        title: "차량 서비스에 연결하지 못했어요",
        description: "잠시 후 다시 시도해 주세요",
      };
    default:
      return {
        title: "문제가 생겼어요",
        description: "잠시 후 다시 시도해 주세요",
      };
  }
}
