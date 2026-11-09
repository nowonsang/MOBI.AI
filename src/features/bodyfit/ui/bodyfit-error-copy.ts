import { pleosErrorCode } from "@/shared/pleos/pleos";

type Copy = { title: string; description: string };

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
          "시트 버튼으로 직접 맞춘 뒤 '지금 자세 기억하기'를 눌러 주세요",
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
          "시트 버튼으로 직접 맞춘 뒤 '지금 자세 기억하기'를 눌러 주세요",
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
