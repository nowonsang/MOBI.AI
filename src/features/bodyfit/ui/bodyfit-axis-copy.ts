import type { SeatAxisGroupId } from "../model/bodyfit-axis-group";
import type { SeatAxis } from "../model/bodyfit.types";

type Directions = { increase: string; decrease: string };

type AxisCopy = {
  /** 축 이름. 어느 화면에서나 같은 말로 부른다 */
  label: string;
  /** 축 앞에 두는 아이콘 원의 기호 (뜻은 옆의 축 이름이 전한다) */
  glyph: string;
  /** 막대 양 끝: 비율 0 쪽과 1 쪽 */
  min: string;
  max: string;
  /** 가이드 조절 안내. 앞에 "더 / 조금 더 / 지나쳤어요. 조금" 이 붙는다 */
  guide: Directions;
  /** 시연 모드에서 시트 버튼 대신 누르는 화면 버튼의 짧은 이름 */
  press: Directions;
};

// 방향은 SeatRatios 를 따른다 (increase = 비율을 키우는 쪽).
export const AXIS_COPY: Record<SeatAxis, AxisCopy> = {
  foreAft: {
    label: "앞뒤 위치",
    glyph: "↔",
    min: "뒤",
    max: "앞",
    guide: { increase: "앞으로 당겨 주세요", decrease: "뒤로 밀어 주세요" },
    press: { increase: "앞으로", decrease: "뒤로" },
  },
  height: {
    label: "높이",
    glyph: "↕",
    min: "낮게",
    max: "높게",
    guide: { increase: "올려 주세요", decrease: "내려 주세요" },
    press: { increase: "올리기", decrease: "내리기" },
  },
  backrest: {
    label: "등받이",
    glyph: "∠",
    min: "눕힘",
    max: "세움",
    guide: { increase: "세워 주세요", decrease: "눕혀 주세요" },
    press: { increase: "세우기", decrease: "눕히기" },
  },
  tilt: {
    label: "좌판 기울기",
    glyph: "⊿",
    min: "내림",
    max: "올림",
    guide: { increase: "앞쪽을 올려 주세요", decrease: "앞쪽을 내려 주세요" },
    press: { increase: "앞쪽 올리기", decrease: "앞쪽 내리기" },
  },
  depth: {
    label: "좌판 길이",
    glyph: "⇔",
    min: "짧게",
    max: "길게",
    guide: { increase: "늘려 주세요", decrease: "줄여 주세요" },
    press: { increase: "늘리기", decrease: "줄이기" },
  },
  headrestHeight: {
    label: "헤드레스트 높이",
    glyph: "⇡",
    min: "낮게",
    max: "높게",
    guide: { increase: "올려 주세요", decrease: "내려 주세요" },
    press: { increase: "올리기", decrease: "내리기" },
  },
  beltHeight: {
    label: "안전벨트 높이",
    glyph: "⇡",
    min: "낮게",
    max: "높게",
    guide: { increase: "올려 주세요", decrease: "내려 주세요" },
    press: { increase: "올리기", decrease: "내리기" },
  },
};

export const AXIS_GROUP_LABEL: Record<SeatAxisGroupId, string> = {
  posture: "자세",
  headBelt: "머리·벨트",
};
