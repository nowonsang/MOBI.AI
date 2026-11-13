import type { SeatAxisGroupId } from "../model/bodyfit-axis-group";
import type { SeatAxis } from "../model/bodyfit.types";

type Directions = { increase: string; decrease: string };

type AxisCopy = {
  /** 축 이름. 어느 화면에서나 같은 말로 부른다 */
  label: string;
  /** 막대 양 끝: 비율 0 쪽과 1 쪽 */
  min: string;
  max: string;
  /** 가이드 조절 안내. 앞에 "더 / 조금 더 / 지나쳤어요. 조금" 이 붙는다 */
  guide: Directions;
  /** 시연 모드에서 시트 버튼 대신 누르는 화면 버튼의 짧은 이름 */
  press: Directions;
  /** 시트 그림 위 라벨: 어느 부위를 어느 쪽으로. 그림의 방향(앞쪽이 오른쪽)에 맞춘 화살표가 앞에 붙는다 */
  stage: Directions;
};

// 방향은 SeatRatios 를 따른다 (increase = 비율을 키우는 쪽).
export const AXIS_COPY: Record<SeatAxis, AxisCopy> = {
  foreAft: {
    label: "앞뒤 위치",
    min: "뒤",
    max: "앞",
    guide: { increase: "앞으로 당겨 주세요", decrease: "뒤로 밀어 주세요" },
    press: { increase: "앞으로", decrease: "뒤로" },
    stage: { increase: "→ 시트 앞으로", decrease: "← 시트 뒤로" },
  },
  height: {
    label: "높이",
    min: "낮게",
    max: "높게",
    guide: { increase: "올려 주세요", decrease: "내려 주세요" },
    press: { increase: "올리기", decrease: "내리기" },
    stage: { increase: "↑ 높이 올리기", decrease: "↓ 높이 내리기" },
  },
  backrest: {
    label: "등받이",
    min: "눕힘",
    max: "세움",
    guide: { increase: "세워 주세요", decrease: "눕혀 주세요" },
    press: { increase: "세우기", decrease: "눕히기" },
    stage: { increase: "↗ 등받이 세우기", decrease: "↖ 등받이 눕히기" },
  },
  tilt: {
    label: "좌판 기울기",
    min: "내림",
    max: "올림",
    guide: { increase: "앞쪽을 올려 주세요", decrease: "앞쪽을 내려 주세요" },
    press: { increase: "앞쪽 올리기", decrease: "앞쪽 내리기" },
    stage: { increase: "↑ 좌판 앞쪽 올리기", decrease: "↓ 좌판 앞쪽 내리기" },
  },
  depth: {
    label: "좌판 길이",
    min: "짧게",
    max: "길게",
    guide: { increase: "늘려 주세요", decrease: "줄여 주세요" },
    press: { increase: "늘리기", decrease: "줄이기" },
    stage: { increase: "→ 좌판 늘리기", decrease: "← 좌판 줄이기" },
  },
  headrestHeight: {
    label: "헤드레스트 높이",
    min: "낮게",
    max: "높게",
    guide: { increase: "올려 주세요", decrease: "내려 주세요" },
    press: { increase: "올리기", decrease: "내리기" },
    stage: { increase: "↑ 헤드레스트 올리기", decrease: "↓ 헤드레스트 내리기" },
  },
  beltHeight: {
    label: "안전벨트 높이",
    min: "낮게",
    max: "높게",
    guide: { increase: "올려 주세요", decrease: "내려 주세요" },
    press: { increase: "올리기", decrease: "내리기" },
    stage: { increase: "↑ 안전벨트 올리기", decrease: "↓ 안전벨트 내리기" },
  },
  lumbar: {
    label: "허리 지지대",
    min: "넣음",
    max: "내밈",
    guide: { increase: "내밀어 주세요", decrease: "넣어 주세요" },
    press: { increase: "내밀기", decrease: "넣기" },
    stage: { increase: "→ 허리 지지대 내밀기", decrease: "← 허리 지지대 넣기" },
  },
  headrestAngle: {
    label: "헤드레스트 각도",
    min: "뒤로",
    max: "앞으로",
    guide: { increase: "앞으로 세워 주세요", decrease: "뒤로 젖혀 주세요" },
    press: { increase: "앞으로", decrease: "뒤로" },
    stage: { increase: "↗ 헤드레스트 앞으로", decrease: "↖ 헤드레스트 뒤로" },
  },
};

export const AXIS_GROUP_LABEL: Record<SeatAxisGroupId, string> = {
  posture: "자세",
  headBelt: "머리·벨트",
  remembered: "기억한 위치",
};

/** 아직 추천하지 못하는 축(기록이 덜 쌓인 허리 지지대·헤드레스트 각도)을 알려 주는 한 줄. 없으면 null */
export function describeAxesToRemember(
  axes: readonly SeatAxis[],
): string | null {
  if (axes.length === 0) return null;
  const names = axes.map((axis) => AXIS_COPY[axis].label).join("·");
  return `${names}는 한 번 맞춰 두면 다음부터 그대로 맞춰요`;
}
