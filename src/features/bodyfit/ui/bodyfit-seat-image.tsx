import { Image, StyleSheet } from "react-native";

// 운전석 그림 (Higgsfield 로 만든 3D 그림, 투명 배경). 실제 차량 사진·로고가 아니다.
// 꾸밈용이라 스크린리더에서는 건너뛴다. 자세 값은 항상 옆의 숫자·글자가 전한다.
const SEAT_IMAGE = require("@/assets/images/seat.png");

/**
 * height: 고정 높이(dp). "fill" 이면 부모 상자를 채운다 (절대 위치라 부모 높이를 늘리지 않는다).
 * 부모 높이를 재서 그림 높이를 정하면 그림이 다시 부모를 늘려 커지기를 되풀이한다.
 */
export function BodyfitSeatImage({
  height = 320,
}: {
  height?: number | "fill";
}) {
  return (
    <Image
      source={SEAT_IMAGE}
      resizeMode="contain"
      style={height === "fill" ? styles.fill : [styles.image, { height }]}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}

const styles = StyleSheet.create({
  image: { width: "100%" },
  // 그림 파일의 원래 크기가 기본 크기로 붙으므로 폭·높이를 직접 100% 로 준다 (top/bottom 만으로는 넘친다)
  fill: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
});
