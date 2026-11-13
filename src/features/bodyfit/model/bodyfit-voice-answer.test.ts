import { interpretYesNo } from "./bodyfit-voice-answer";

describe("interpretYesNo", () => {
  it.each([
    "응",
    "응응",
    "네",
    "네.",
    "예",
    "어",
    "넵",
    "맞아",
    "맞아요",
    "네 맞아요",
    "응 나야",
    "그래",
    "ㅇㅇ",
    "OK",
  ])("%s 는 긍정이다", (utterance) => {
    expect(interpretYesNo(utterance)).toBe("yes");
  });

  it.each([
    "아니",
    "아니요",
    "아뇨",
    "다른 사람이야",
    "틀렸어",
    "안 맞아",
    "no",
  ])("%s 는 부정이다", (utterance) => {
    expect(interpretYesNo(utterance)).toBe("no");
  });

  it("긍정과 부정이 섞이면 넘어가지 않는 쪽(부정)으로 본다", () => {
    expect(interpretYesNo("아니 맞아")).toBe("no");
  });

  it.each(["", "   ", "음", "오늘 날씨 어때", "네비 켜 줘"])(
    "%s 처럼 애매하면 판단하지 않는다",
    (utterance) => {
      expect(interpretYesNo(utterance)).toBe("unclear");
    },
  );

  it("문자열이 아니거나 지나치게 긴 입력은 판단하지 않는다", () => {
    expect(interpretYesNo(undefined)).toBe("unclear");
    expect(interpretYesNo(42)).toBe("unclear");
    expect(interpretYesNo("네".repeat(2000))).toBe("unclear");
  });

  it("긴 말은 앞부분만 읽는다", () => {
    expect(interpretYesNo(`${"가".repeat(50)} 네`)).toBe("unclear");
  });
});
