import { Fragment, useState, type ReactNode } from "react";
import { View, useWindowDimensions } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import type { SeatAxis } from "../model/bodyfit.types";
import { BodyfitSeatImage } from "./bodyfit-seat-image";

/**
 * 그림 위 라벨 하나.
 * active: 지금 할 일(파란 면), done: 맞춘 곳(초록 ✓), todo: 차례를 기다리는 곳(회색), issue: 멈췄거나 못 간 곳.
 * 색만으로 구분하지 않도록 글자(✓, "중", "기다리는 중")도 함께 바꾼다.
 */
export type SeatMark = {
  axis: SeatAxis;
  text: string;
  tone: "active" | "done" | "todo" | "issue";
};

type BodyfitSeatPictureProps = {
  marks: SeatMark[];
  /** 스크린리더가 읽는 그림 전체 설명 */
  accessibilityLabel: string;
  /** 그림 양옆에 라벨 자리가 없을 때(좁은 창) 대신 보여 줄 것 */
  fallback: ReactNode;
};

// 그림 파일(seat.png)의 비율. 앞쪽이 오른쪽을 본다.
const IMAGE_RATIO = 574 / 720;

/**
 * 라벨을 붙일 그림 위 지점(그림 상자 기준 %)과 라벨을 놓을 쪽.
 * 한쪽 라벨끼리 세로로 라벨 높이보다 멀리 두어 겹치지 않게 한다 (그림 높이 360dp 기준).
 */
const ANCHORS: Record<
  SeatAxis,
  { x: number; y: number; side: "left" | "right" }
> = {
  headrestHeight: { x: 42, y: 6, side: "right" },
  headrestAngle: { x: 22, y: 10, side: "left" },
  beltHeight: { x: 8, y: 30, side: "left" },
  backrest: { x: 50, y: 30, side: "right" },
  lumbar: { x: 14, y: 54, side: "left" },
  tilt: { x: 95, y: 66, side: "right" },
  depth: { x: 82, y: 81, side: "right" },
  height: { x: 14, y: 82, side: "left" },
  foreAft: { x: 62, y: 97, side: "right" },
};

// 그림 크기: 창 높이의 40% 를 이 범위 안에서 쓴다.
const IMAGE_MIN_HEIGHT = 280;
const IMAGE_MAX_HEIGHT = 420;
// 그림 한쪽에 라벨을 놓을 폭. 가장 긴 라벨("↑ 좌판 앞쪽 올리기 21%")이 한 줄에 들어가는 폭이다.
const LABEL_ROOM = 440;

const DOT = 20;
const PILL_HEIGHT = 52;

/** 시트 그림 위 해당 부위에 점과 라벨을 붙인다. 자세 탭·자동 조절·가이드 조절이 같은 그림을 쓴다. */
export function BodyfitSeatPicture({
  marks,
  accessibilityLabel,
  fallback,
}: BodyfitSeatPictureProps) {
  const styles = useStyles();
  const { height: windowHeight } = useWindowDimensions();
  // 놓일 자리의 폭. 폭을 재서 그림을 키우지는 않으므로(높이는 창 높이로 정한다) 다시 재기가 되풀이되지 않는다.
  const [width, setWidth] = useState(0);
  // 낮은 창에서도 다른 내용·버튼과 함께 한 화면에 들어오게 창 높이에 맞춰 그림 크기를 정한다.
  const imageHeight = Math.max(
    IMAGE_MIN_HEIGHT,
    Math.min(IMAGE_MAX_HEIGHT, Math.round(windowHeight * 0.4)),
  );
  const imageWidth = Math.round(imageHeight * IMAGE_RATIO);
  const fits = width >= imageWidth + LABEL_ROOM * 2;

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width === 0 ? (
        // 폭을 재기 전에는 그림 자리만 비워 둔다 (목록이 잠깐 보였다 바뀌지 않게).
        <View style={{ height: imageHeight + PILL_HEIGHT }} />
      ) : !fits ? (
        fallback
      ) : (
        <View
          style={styles.stage}
          accessible
          accessibilityLabel={accessibilityLabel}
        >
          <View style={{ height: imageHeight, width: imageWidth }}>
            <BodyfitSeatImage height="fill" />
            {marks.map((mark) => {
              const anchor = ANCHORS[mark.axis];
              return (
                // 점과 라벨은 그림 상자를 기준으로 놓는다 (감싸는 View 를 두면 높이 0 인 상자가 기준이 된다).
                <Fragment key={mark.axis}>
                  <View
                    style={[
                      styles.dot,
                      styles[`dot_${mark.tone}`],
                      { left: `${anchor.x}%`, top: `${anchor.y}%` },
                    ]}
                  />
                  {/* 라벨 줄: 점 바로 옆에서 바깥쪽으로 LABEL_ROOM 폭을 차지하고, 라벨은 내용 폭만큼만 칠한다. */}
                  <View
                    style={[
                      styles.labelRow,
                      { top: `${anchor.y}%` },
                      anchor.side === "right"
                        ? [styles.labelRight, { left: `${anchor.x}%` }]
                        : [styles.labelLeft, { right: `${100 - anchor.x}%` }],
                    ]}
                  >
                    <View style={[styles.pill, styles[`pill_${mark.tone}`]]}>
                      <AppText
                        variant="secondary"
                        tone={
                          mark.tone === "active"
                            ? "inverse"
                            : mark.tone === "done"
                              ? "default"
                              : "tertiary"
                        }
                        style={[
                          styles.strong,
                          mark.tone === "done" && styles.doneText,
                        ]}
                        numberOfLines={1}
                      >
                        {mark.text}
                      </AppText>
                    </View>
                  </View>
                </Fragment>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const useStyles = themedStyles((colors) => ({
  // 라벨이 그림 양옆으로 나가므로 가운데에 두고 위아래로 라벨 반만큼 여유를 둔다.
  stage: { alignItems: "center", paddingVertical: PILL_HEIGHT / 2 },
  dot: {
    position: "absolute",
    marginLeft: -DOT / 2,
    marginTop: -DOT / 2,
    width: DOT,
    height: DOT,
    borderRadius: radius.pill,
    borderWidth: 4,
    borderColor: colors.surface,
  },
  dot_active: { backgroundColor: colors.primary },
  dot_done: { backgroundColor: colors.success },
  dot_todo: { backgroundColor: colors.inkDisabled },
  dot_issue: { backgroundColor: colors.warning },
  labelRow: {
    position: "absolute",
    width: LABEL_ROOM,
    height: PILL_HEIGHT,
    marginTop: -PILL_HEIGHT / 2,
    flexDirection: "row",
    alignItems: "center",
  },
  labelRight: {
    justifyContent: "flex-start",
    paddingLeft: DOT / 2 + spacing.xs,
  },
  labelLeft: {
    justifyContent: "flex-end",
    paddingRight: DOT / 2 + spacing.xs,
  },
  pill: {
    minHeight: PILL_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  pill_active: { backgroundColor: colors.primary },
  // 맞춘 곳·기다리는 곳은 흰 면 + 테두리로 낮춘다 (강조는 지금 할 일 한 곳만).
  pill_done: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.success,
  },
  pill_todo: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
  },
  pill_issue: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.warning,
  },
  strong: { fontWeight: "700" },
  // 흰 면 위 초록 글자 (theme.test.ts 의 success·surface 조합으로 대비를 검사한다)
  doneText: { color: colors.success },
}));
