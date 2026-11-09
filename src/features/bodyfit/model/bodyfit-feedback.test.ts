import { describeNudges, interpretByRules } from "./bodyfit-feedback";

describe("interpretByRules", () => {
  it("페달이 멀면 시트를 앞으로", () => {
    expect(interpretByRules("페달이 너무 멀어").nudges).toEqual([
      { axis: "foreAft", direction: "increase", amount: "small" },
    ]);
  });

  it("'등받이를 뒤로'는 시트 이동이 아니라 등받이 눕히기다", () => {
    expect(interpretByRules("등받이를 많이 뒤로 해 줘").nudges).toEqual([
      { axis: "backrest", direction: "decrease", amount: "medium" },
    ]);
  });

  it("편했다는 대답에는 조절하지 않는다", () => {
    const result = interpretByRules("괜찮았어");
    expect(result.nudges).toEqual([]);
    expect(result.reply).toContain("지금 자세");
  });

  it("해석할 수 없으면 다시 말해 달라고 한다", () => {
    expect(interpretByRules("음").reply).toContain("말해 주세요");
  });
});

describe("describeNudges", () => {
  it("여러 조절을 한 문장으로 만든다", () => {
    expect(
      describeNudges([
        { axis: "foreAft", direction: "increase", amount: "small" },
        { axis: "backrest", direction: "increase", amount: "medium" },
      ]),
    ).toBe("시트를 조금 앞으로 옮겨 보고, 등받이를 세워 볼게요");
  });
});
