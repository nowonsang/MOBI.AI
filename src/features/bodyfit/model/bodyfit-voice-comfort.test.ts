import type { DriverComfortState } from "@/shared/pleos/pleos.types";

import {
  describeComfortValue,
  interpretVoiceRequest,
  planVoiceComfort,
  type ComfortRequest,
} from "./bodyfit-voice-comfort";

const interpret = (utterance: string) =>
  interpretVoiceRequest(utterance, { comfort: true });

const requestsOf = (utterance: string): ComfortRequest[] => {
  const result = interpret(utterance);
  if (result.kind !== "comfort")
    throw new Error(`온도 요청이 아님: ${utterance}`);
  return result.requests;
};

const vehicle = (overrides: DriverComfortState = {}): DriverComfortState => ({
  seatHeat: { value: 0, min: 0, max: 3 },
  seatVent: { value: 0, min: 0, max: 3 },
  steeringHeat: { value: 0, min: 0, max: 1 },
  cabinTarget: { value: 22, min: 17, max: 27 },
  cabinCurrent: 20,
  fanSpeed: { value: 3, min: 1, max: 8 },
  fanDirection: { value: "face", options: ["face", "floor", "faceFloor"] },
  fanMode: "manual",
  ...overrides,
});

const plan = (utterance: string, state = vehicle()) =>
  planVoiceComfort(requestsOf(utterance), state, null);

describe("interpretVoiceRequest: 온도 이야기", () => {
  it.each<[string, ComfortRequest[]]>([
    ["추워요", [{ kind: "feel", feel: "cold", amount: "small" }]],
    ["너무 더워요", [{ kind: "feel", feel: "hot", amount: "medium" }]],
    ["차 안 더워요", [{ kind: "feel", feel: "hot", amount: "small" }]],
    ["핸들 열선 켜줘", [{ kind: "power", target: "steeringHeat", on: true }]],
    ["시트 열선 꺼줘", [{ kind: "power", target: "seatHeat", on: false }]],
    ["통풍 틀어줘", [{ kind: "power", target: "seatVent", on: true }]],
    [
      "바람 좀 줄여줘",
      [
        {
          kind: "step",
          target: "fanSpeed",
          direction: "decrease",
          amount: "small",
        },
      ],
    ],
    [
      "온도 많이 올려 줘",
      [
        {
          kind: "step",
          target: "cabinTarget",
          direction: "increase",
          amount: "medium",
        },
      ],
    ],
    [
      "에어컨 좀 세게 틀어줘",
      [
        {
          kind: "step",
          target: "cabinTarget",
          direction: "decrease",
          amount: "small",
        },
      ],
    ],
    ["평소 온도로 맞춰줘", [{ kind: "usual" }]],
    ["손이 시려워", [{ kind: "power", target: "steeringHeat", on: true }]],
  ])("%s", (utterance, expected) => {
    expect(requestsOf(utterance)).toEqual(expected);
  });

  it("'시트 열선 올려줘'는 시트 높이가 아니라 열선 한 단계 올리기다", () => {
    expect(requestsOf("시트 열선 올려줘")).toEqual([
      {
        kind: "step",
        target: "seatHeat",
        direction: "increase",
        amount: "small",
      },
    ]);
  });

  it("'핸들 열선'의 열선은 시트 열선으로 읽지 않는다", () => {
    expect(requestsOf("핸들 열선 꺼줘")).toHaveLength(1);
  });

  it("동사가 없는 대상은 뒤 대상의 동사를 물려받는다", () => {
    expect(requestsOf("시트 열선이랑 핸들 열선 켜줘")).toEqual([
      { kind: "power", target: "seatHeat", on: true },
      { kind: "power", target: "steeringHeat", on: true },
    ]);
  });

  it("대상마다 다른 동사를 쓴다", () => {
    expect(requestsOf("시트 열선은 끄고 통풍 틀어줘")).toEqual([
      { kind: "power", target: "seatHeat", on: false },
      { kind: "power", target: "seatVent", on: true },
    ]);
  });

  it("무엇을 바꿀지 말했으면 '추워서'는 이유로만 듣는다", () => {
    expect(requestsOf("추워서 그래, 핸들 열선 켜줘")).toEqual([
      { kind: "power", target: "steeringHeat", on: true },
    ]);
  });

  it.each(["안 추워요", "덥지 않아"])(
    "춥지·덥지 않다는 말에는 바꾸지 않는다 (%s)",
    (utterance) => {
      const result = interpret(utterance);
      expect(result.kind).toBe("none");
    },
  );

  it.each([
    "더워요, 시트도 좀 뒤로 밀어줘",
    "추운데 등받이 세워줘",
    "시트 좀 낮춰주고 열선 켜줘",
  ])("시트 자세와 온도가 섞이면 조절안을 만들지 않는다 (%s)", (utterance) => {
    const result = interpret(utterance);
    expect(result).toEqual({
      kind: "none",
      reply: expect.stringContaining("하나씩"),
    });
  });

  it.each(["바람 방향 바꿔줘", "바람 꺼줘", "에어컨 꺼줘"])(
    "바람 방향과 공조 전원은 말로 바꾸지 않는다 (%s)",
    (utterance) => {
      const result = interpret(utterance);
      expect(result).toEqual({
        kind: "none",
        reply: expect.stringContaining("공조 버튼"),
      });
    },
  );

  it("춥다와 덥다가 함께 나오면 다시 말해 달라고 한다", () => {
    expect(interpret("추웠다 더웠다 해").kind).toBe("none");
  });

  it("온도 이야기가 없으면 시트 해석으로 넘긴다", () => {
    expect(interpret("등받이 좀 세워줘")).toEqual({
      kind: "seat",
      interpretation: expect.objectContaining({
        nudges: [{ axis: "backrest", direction: "increase", amount: "small" }],
      }),
    });
  });

  it("온도를 맞출 수 없는 빌드에서는 온도 이야기도 시트 해석으로만 본다", () => {
    const result = interpretVoiceRequest("추워요", { comfort: false });
    expect(result.kind).toBe("seat");
  });

  it("비정상적으로 긴 문장은 앞부분만 본다", () => {
    const result = interpret(`${"아".repeat(300)} 추워요`);
    expect(result.kind).toBe("seat");
  });
});

describe("planVoiceComfort: 양 제한과 차량 범위", () => {
  it("추우면 실내 온도를 1℃ 올린다", () => {
    const result = plan("추워요");
    expect(result.changes).toEqual({ cabinTarget: 23 });
    expect(result.reply).toBe("실내 온도를 23도로 올릴게요");
  });

  it("'너무' 더워도 한 번에 2℃ 까지만 내린다", () => {
    expect(plan("너무 더워요").changes).toEqual({ cabinTarget: 20 });
  });

  it("차량 범위를 넘지 않는다", () => {
    const state = vehicle({ cabinTarget: { value: 26.5, min: 17, max: 27 } });
    expect(plan("너무 추워요", state).changes).toEqual({ cabinTarget: 27 });
  });

  it("이미 끝 값이면 바꾸지 않고 그렇게 답한다", () => {
    const state = vehicle({ cabinTarget: { value: 27, min: 17, max: 27 } });
    const result = plan("추워요", state);
    expect(result.changes).toEqual({});
    expect(result.reply).toContain("이미 가장 높아요");
  });

  it("온도를 못 바꾸는 차는 추우면 시트 열선을, 더우면 통풍을 한 단계 올린다", () => {
    const state = vehicle({ cabinTarget: undefined });
    expect(plan("추워요", state).changes).toEqual({ seatHeat: 1 });
    expect(plan("더워요", state).changes).toEqual({ seatVent: 1 });
  });

  it("열선은 '많이'라고 해도 한 단계만 올린다", () => {
    const state = vehicle({ seatHeat: { value: 1, min: 0, max: 3 } });
    expect(plan("시트 열선 많이 올려줘", state).changes).toEqual({
      seatHeat: 2,
    });
  });

  it("켜 달라고 하면 1단으로 켠다", () => {
    const result = plan("시트 열선 켜줘");
    expect(result.changes).toEqual({ seatHeat: 1 });
    expect(result.reply).toBe("시트 열선을 1단으로 켤게요");
  });

  it("단계가 하나뿐인 항목은 '켤게요'로만 말한다", () => {
    expect(plan("핸들 열선 켜줘").reply).toBe("핸들 열선을 켤게요");
  });

  it("이미 켜져 있으면 단계를 올리지 않는다", () => {
    const state = vehicle({ seatHeat: { value: 2, min: 0, max: 3 } });
    const result = plan("시트 열선 켜줘", state);
    expect(result.changes).toEqual({});
    expect(result.reply).toContain("이미 켜져 있어요");
  });

  it("끄기는 바로 0 으로 간다", () => {
    const state = vehicle({ seatHeat: { value: 3, min: 0, max: 3 } });
    expect(plan("시트 열선 꺼줘", state).changes).toEqual({ seatHeat: 0 });
  });

  it("말로는 열선을 냉각(음수) 쪽으로 보내지 않는다", () => {
    const state = vehicle({ seatHeat: { value: 0, min: -3, max: 3 } });
    const result = plan("시트 열선 내려줘", state);
    expect(result.changes).toEqual({});
  });

  it("열선을 켜면 켜져 있던 통풍을 함께 끈다", () => {
    const state = vehicle({ seatVent: { value: 2, min: 0, max: 3 } });
    const result = plan("시트 열선 켜줘", state);
    expect(result.changes).toEqual({ seatHeat: 1, seatVent: 0 });
    expect(result.reply).toBe("시트 열선을 1단으로 켜고, 시트 통풍을 끌게요");
  });

  it("차량이 지원하지 않는 항목은 바꿀 수 없다고 답한다", () => {
    const state = vehicle({ seatVent: undefined });
    const result = plan("통풍 틀어줘", state);
    expect(result.changes).toEqual({});
    expect(result.reply).toBe("시트 통풍은 이 차에서는 바꿀 수 없어요");
  });

  it("지원하는 항목만 바꾸고 나머지는 알려 준다", () => {
    const state = vehicle({ steeringHeat: undefined });
    const result = plan("시트 열선이랑 핸들 열선 켜줘", state);
    expect(result.changes).toEqual({ seatHeat: 1 });
    expect(result.reply).toBe(
      "시트 열선을 1단으로 켤게요. 핸들 열선은 이 차에서는 바꿀 수 없어요",
    );
  });

  it("온도 항목이 하나도 없는 차에서 춥다고 하면 바꿀 수 없다고 답한다", () => {
    const result = plan("추워요", { cabinCurrent: 20 });
    expect(result.changes).toEqual({});
    expect(result.reply).toContain("이 차에서는");
  });

  it("풍량은 한두 단계씩만 바꾼다", () => {
    expect(plan("바람 좀 줄여줘").changes).toEqual({ fanSpeed: 2 });
    expect(plan("바람 많이 세게 해줘").changes).toEqual({ fanSpeed: 5 });
  });

  it.each<["auto" | "off", string]>([
    ["auto", "자동 공조"],
    ["off", "꺼져"],
  ])("공조가 %s 이면 풍량을 건드리지 않는다", (fanMode, word) => {
    const result = plan("바람 좀 줄여줘", vehicle({ fanMode }));
    expect(result.changes).toEqual({});
    expect(result.reply).toContain(word);
  });

  it("차량이 준 값이 저장 범위를 벗어나면 아무것도 바꾸지 않는다", () => {
    const state = vehicle({ cabinTarget: { value: 60, min: 50, max: 70 } });
    const result = plan("추워요", state);
    expect(result.changes).toEqual({});
    expect(result.items).toEqual([]);
  });
});

describe("planVoiceComfort: 평소 온도", () => {
  const usual = {
    seatHeat: 2,
    cabinTarget: 24,
    fanDirection: "floor",
  } as const;

  it("기록으로 고른 추천과 다른 항목만 바꾼다", () => {
    const state = vehicle({ seatHeat: { value: 2, min: 0, max: 3 } });
    const result = planVoiceComfort([{ kind: "usual" }], state, usual);
    expect(result.changes).toEqual({ cabinTarget: 24, fanDirection: "floor" });
    expect(result.items).toEqual([
      { key: "cabinTarget", from: 22, to: 24 },
      { key: "fanDirection", from: "face", to: "floor" },
    ]);
    expect(result.reply).toBe("평소 온도로 맞출게요");
  });

  it("기록이 없으면 바꾸지 않는다", () => {
    const result = planVoiceComfort([{ kind: "usual" }], vehicle(), null);
    expect(result.changes).toEqual({});
    expect(result.reply).toContain("기록이 없어요");
  });

  it("이미 평소와 같으면 그렇게 답한다", () => {
    const result = planVoiceComfort([{ kind: "usual" }], vehicle(), {
      cabinTarget: 22,
    });
    expect(result.changes).toEqual({});
    expect(result.reply).toContain("평소 온도와 같아요");
  });
});

describe("describeComfortValue", () => {
  it("값을 화면 말로 바꾼다", () => {
    const state = vehicle();
    expect(describeComfortValue("seatHeat", 0, state)).toBe("꺼짐");
    expect(describeComfortValue("seatHeat", 2, state)).toBe("2단");
    expect(describeComfortValue("steeringHeat", 1, state)).toBe("켬");
    expect(describeComfortValue("cabinTarget", 22.5, state)).toBe("22.5℃");
    expect(describeComfortValue("fanDirection", "faceFloor", state)).toBe(
      "얼굴과 발",
    );
  });
});
