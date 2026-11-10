import { learnOffsets } from "./bodyfit-learning";
import { applyNudges } from "./bodyfit-seat";
import {
  TOUCH_FEEDBACK_CHOICES,
  nudgesForTouchChoices,
  toggleTouchChoice,
  type TouchFeedbackChoiceId,
} from "./bodyfit-touch-feedback";
import { GUIDE_TOLERANCE } from "./bodyfit-guide";

describe("터치 피드백 선택", () => {
  it("선택지를 누르면 고르고, 다시 누르면 푼다", () => {
    const picked = toggleTouchChoice([], "backrest-increase");
    expect(picked).toEqual(["backrest-increase"]);
    expect(toggleTouchChoice(picked, "backrest-increase")).toEqual([]);
  });

  it("같은 축의 반대 방향을 고르면 앞서 고른 쪽을 뺀다", () => {
    const picked = toggleTouchChoice(
      ["backrest-increase", "foreAft-decrease"],
      "backrest-decrease",
    );
    expect(picked).toEqual(["foreAft-decrease", "backrest-decrease"]);
  });

  it("고른 선택지를 축·방향·양 조절안으로 바꾼다", () => {
    expect(nudgesForTouchChoices(["backrest-increase", "height-decrease"])).toEqual([
      { axis: "backrest", direction: "increase", amount: "medium" },
      { axis: "height", direction: "decrease", amount: "medium" },
    ]);
  });

  it("아무것도 고르지 않으면(편했어요) 조절안이 없다", () => {
    expect(nudgesForTouchChoices([])).toEqual([]);
  });

  it("목록에 없는 값과 같은 축의 중복은 버린다", () => {
    const tampered = [
      "backrest-increase",
      "backrest-decrease",
      "steering-wheel",
    ] as TouchFeedbackChoiceId[];
    expect(nudgesForTouchChoices(tampered)).toEqual([
      { axis: "backrest", direction: "increase", amount: "medium" },
    ]);
  });

  it("한 축에는 올리기·내리기 두 선택지만 있고 한 섹션 7개를 넘지 않는다", () => {
    expect(TOUCH_FEEDBACK_CHOICES.length).toBeLessThanOrEqual(7);
    const perAxis = new Map<string, number>();
    for (const { nudge } of TOUCH_FEEDBACK_CHOICES) {
      perAxis.set(nudge.axis, (perAxis.get(nudge.axis) ?? 0) + 1);
    }
    expect([...perAxis.values()].every((count) => count === 2)).toBe(true);
  });

  it("피드백 한 번이 다음 추천을 가이드 허용 오차보다 크게 움직인다", () => {
    const baseline = { backrest: 0.6 };
    const current = { backrest: 0.6 };
    const final = applyNudges(
      current,
      nudgesForTouchChoices(["backrest-increase"]),
    );
    // 주행 시작 기록(추천 그대로) 뒤에 터치 피드백 기록이 쌓인 경우
    const offsets = learnOffsets([
      { profileId: "p", at: 1, baseline, final: current, source: "drive-start" },
      { profileId: "p", at: 2, baseline, final, source: "touch" },
    ]);
    expect(offsets.backrest).toBeGreaterThan(GUIDE_TOLERANCE);
  });

  it("범위 끝에서는 0~1 을 벗어나지 않는다", () => {
    const final = applyNudges(
      { backrest: 0.98, foreAft: 0.01 },
      nudgesForTouchChoices(["backrest-increase", "foreAft-decrease"]),
    );
    expect(final).toEqual({ backrest: 1, foreAft: 0 });
  });
});
