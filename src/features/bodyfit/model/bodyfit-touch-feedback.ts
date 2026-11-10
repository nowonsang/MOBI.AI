import type { SeatNudge } from "./bodyfit.types";

// D-2 터치 피드백: 주행 후 질문에 선택지로 답한다. 음성 해석과 같은 형식(SeatNudge)으로 바꿔 같은 학습 경로를 탄다.
// 한 번의 선택이 다음 추천에서 눈에 보이게 달라지도록 medium(범위의 8%)을 쓴다:
// small(4%)은 기록 평균을 거치면 가이드 허용 오차(3%)보다 작아져 추천이 그대로로 보인다.
export const TOUCH_FEEDBACK_CHOICES = [
  {
    id: "backrest-increase",
    label: "등받이 세우기",
    nudge: { axis: "backrest", direction: "increase", amount: "medium" },
  },
  {
    id: "backrest-decrease",
    label: "등받이 눕히기",
    nudge: { axis: "backrest", direction: "decrease", amount: "medium" },
  },
  {
    id: "foreAft-increase",
    label: "시트 앞으로",
    nudge: { axis: "foreAft", direction: "increase", amount: "medium" },
  },
  {
    id: "foreAft-decrease",
    label: "시트 뒤로",
    nudge: { axis: "foreAft", direction: "decrease", amount: "medium" },
  },
  {
    id: "height-increase",
    label: "시트 높이기",
    nudge: { axis: "height", direction: "increase", amount: "medium" },
  },
  {
    id: "height-decrease",
    label: "시트 낮추기",
    nudge: { axis: "height", direction: "decrease", amount: "medium" },
  },
] as const satisfies readonly { id: string; label: string; nudge: SeatNudge }[];

export type TouchFeedbackChoiceId = (typeof TOUCH_FEEDBACK_CHOICES)[number]["id"];

const choiceOf = (id: TouchFeedbackChoiceId) =>
  TOUCH_FEEDBACK_CHOICES.find((choice) => choice.id === id);

/**
 * 선택지를 누를 때의 다음 선택 목록. 이미 고른 것은 풀고, 새로 고르면 같은 축의 반대 방향은 뺀다
 * ("등받이 세우기"와 "등받이 눕히기"가 함께 남지 않게).
 */
export function toggleTouchChoice(
  selected: readonly TouchFeedbackChoiceId[],
  id: TouchFeedbackChoiceId,
): TouchFeedbackChoiceId[] {
  if (selected.includes(id)) return selected.filter((item) => item !== id);
  const axis = choiceOf(id)?.nudge.axis;
  return [
    ...selected.filter((item) => choiceOf(item)?.nudge.axis !== axis),
    id,
  ];
}

/** 고른 선택지 → 조절안. 목록에 없는 id 는 버리고, 축마다 하나만 남긴다. */
export function nudgesForTouchChoices(
  selected: readonly TouchFeedbackChoiceId[],
): SeatNudge[] {
  const nudges: SeatNudge[] = [];
  for (const id of selected) {
    const nudge = choiceOf(id)?.nudge;
    if (!nudge || nudges.some((item) => item.axis === nudge.axis)) continue;
    nudges.push(nudge);
  }
  return nudges;
}
