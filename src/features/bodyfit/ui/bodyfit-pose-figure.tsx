import { useState } from "react";
import { View } from "react-native";

import { radius } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import type { PoseFigure } from "../model/bodyfit-body-scan";

type Props = {
  figure: PoseFigure;
  /** 스크린리더가 읽을 설명 (그림은 꾸밈이 아니라 "무엇을 읽었는지"를 보여 준다) */
  label: string;
};

// 그림 높이 상한. 세로 사진도 한 화면에 들어오게 한다.
const MAX_HEIGHT = 420;
const JOINT = 20;
const BONE = 8;

/** 인식한 관절을 점과 선으로 그린다. 사진은 남기지 않으므로 사진 대신 이 뼈대를 보여 준다. */
export function BodyfitPoseFigure({ figure, label }: Props) {
  const styles = useStyles();
  const [size, setSize] = useState({ width: 0, height: 0 });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={[
        styles.frame,
        {
          aspectRatio: figure.aspectRatio,
          maxWidth: MAX_HEIGHT * figure.aspectRatio,
        },
      ]}
    >
      {size.width > 0
        ? figure.bones.map((bone, index) => {
            const x1 = bone.from.x * size.width;
            const y1 = bone.from.y * size.height;
            const x2 = bone.to.x * size.width;
            const y2 = bone.to.y * size.height;
            const length = Math.hypot(x2 - x1, y2 - y1);
            return (
              <View
                key={index}
                style={[
                  styles.bone,
                  {
                    width: length,
                    // 선은 가운데를 축으로 돈다: 두 점의 가운데에 놓고 기울인다.
                    left: (x1 + x2) / 2 - length / 2,
                    top: (y1 + y2) / 2 - BONE / 2,
                    transform: [
                      { rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` },
                    ],
                  },
                ]}
              />
            );
          })
        : null}
      {size.width > 0
        ? figure.joints.map((joint) => (
            <View
              key={joint.name}
              style={[
                styles.joint,
                {
                  left: joint.x * size.width - JOINT / 2,
                  top: joint.y * size.height - JOINT / 2,
                },
              ]}
            />
          ))
        : null}
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  frame: {
    width: "100%",
    alignSelf: "center",
    borderRadius: radius.card,
    backgroundColor: colors.fill,
    overflow: "hidden",
  },
  bone: {
    position: "absolute",
    height: BONE,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  joint: {
    position: "absolute",
    width: JOINT,
    height: JOINT,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
}));
