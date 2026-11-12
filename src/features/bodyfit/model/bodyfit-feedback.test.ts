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

  it.each([
    "헤드레스트 좀 올려줘",
    "머리 받침이 너무 낮아, 높여 줘",
    "안전벨트를 내려 줘",
    "벨트가 목에 걸려, 올려 줘",
    "좌판 길이를 앞으로 늘려 줘",
  ])("헤드레스트·안전벨트·좌판 길이 이야기는 시트 조절로 읽지 않는다 (%s)", (utterance) => {
    const result = interpretByRules(utterance);
    expect(result.nudges).toEqual([]);
    expect(result.reply).toContain("화면 안내");
  });

  it("헤드레스트 이야기가 없으면 '올려 줘'는 그대로 시트 높이다", () => {
    expect(interpretByRules("시트 좀 올려 줘").nudges).toEqual([
      { axis: "height", direction: "increase", amount: "small" },
    ]);
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

describe("허리 지지대는 말로 바꾸지 않는다", () => {
  it.each(["허리 지지대 좀 올려줘", "허리받침을 앞으로 해 줘", "럼버 서포트 높여 줘"])(
    "허리 지지대 이야기는 시트 조절로 읽지 않는다 (%s)",
    (utterance) => {
      const result = interpretByRules(utterance);
      expect(result.nudges).toEqual([]);
      expect(result.reply).toContain("허리 지지대");
    },
  );

  it("허리가 불편하다는 말은 지지대 이야기가 아니라 그대로 해석한다", () => {
    expect(interpretByRules("허리가 아파서 등받이를 세워 줘").nudges).toEqual([
      { axis: "backrest", direction: "increase", amount: "small" },
    ]);
  });
});
