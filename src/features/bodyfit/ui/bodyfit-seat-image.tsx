import { Image, StyleSheet } from "react-native";

// 운전석 그림 (Higgsfield 로 만든 3D 그림, 투명 배경). 실제 차량 사진·로고가 아니다.
// 꾸밈용이라 스크린리더에서는 건너뛴다. 자세 값은 항상 옆의 숫자·글자가 전한다.
const SEAT_IMAGE = require("@/assets/images/seat.png");

export function BodyfitSeatImage({ height = 320 }: { height?: number }) {
  return (
    <Image
      source={SEAT_IMAGE}
      resizeMode="contain"
      style={[styles.image, { height }]}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}

const styles = StyleSheet.create({
  image: { width: "100%" },
});
