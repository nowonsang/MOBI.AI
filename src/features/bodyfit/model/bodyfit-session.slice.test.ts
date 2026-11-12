import {
  bodyfitSessionSlice,
  driveContextSelected,
  driverSelected,
  comfortProposed,
  feedbackProposed,
  occupantChanged,
  selectActiveDriverId,
  selectDriveContext,
  selectPendingComfort,
  selectPendingFeedback,
} from "./bodyfit-session.slice";

const reduce = bodyfitSessionSlice.reducer;
const root = (state: ReturnType<typeof reduce>) => ({
  [bodyfitSessionSlice.name]: state,
});

describe("bodyfitSessionSlice", () => {
  it("운전석에 앉은 사람이 바뀌면 고른 운전자와 확인 대기 중인 조절안을 잊는다", () => {
    let state = reduce(undefined, driverSelected("p1"));
    state = reduce(
      state,
      feedbackProposed({
        nudges: [{ axis: "backrest", direction: "increase", amount: "small" }],
        reply: "등받이를 조금 세울게요",
      }),
    );

    state = reduce(state, occupantChanged());

    expect(selectActiveDriverId(root(state))).toBeNull();
    expect(selectPendingFeedback(root(state))).toBeNull();
  });
});

describe("bodyfitSessionSlice: 음성 온도 조절안 (E-4)", () => {
  const plan = {
    changes: { cabinTarget: 23 },
    items: [{ key: "cabinTarget" as const, from: 22, to: 23 }],
    reply: "실내 온도를 23도로 올릴게요",
  };
  const seat = {
    nudges: [
      {
        axis: "backrest" as const,
        direction: "increase" as const,
        amount: "small" as const,
      },
    ],
    reply: "등받이를 조금 세워 볼게요",
  };

  it("시트 조절안과 온도 조절안은 나중에 말한 하나만 남는다", () => {
    let state = reduce(undefined, feedbackProposed(seat));
    state = reduce(state, comfortProposed(plan));
    expect(selectPendingComfort(root(state))).toEqual(plan);
    expect(selectPendingFeedback(root(state))).toBeNull();

    state = reduce(state, feedbackProposed(seat));
    expect(selectPendingComfort(root(state))).toBeNull();
  });

  it("운전석에 앉은 사람이 바뀌면 온도 조절안도 잊는다", () => {
    let state = reduce(undefined, comfortProposed(plan));
    state = reduce(state, occupantChanged());
    expect(selectPendingComfort(root(state))).toBeNull();
  });
});

describe("bodyfitSessionSlice: 운전 상황 (C-5)", () => {
  it("상황을 고르지 않으면 평소다", () => {
    const state = reduce(undefined, driverSelected("p1"));
    expect(selectDriveContext(root(state))).toBe("usual");
  });

  it("고른 상황을 기억한다", () => {
    let state = reduce(undefined, driverSelected("p1"));
    state = reduce(state, driveContextSelected("long"));
    expect(selectDriveContext(root(state))).toBe("long");
  });

  it("같은 운전자 화면을 다시 열어도 고른 상황은 그대로다", () => {
    let state = reduce(undefined, driverSelected("p1"));
    state = reduce(state, driveContextSelected("commute"));
    state = reduce(state, driverSelected("p1"));
    expect(selectDriveContext(root(state))).toBe("commute");
  });

  it("다른 운전자로 바꾸면 앞사람의 상황을 이어받지 않고 평소로 돌아간다", () => {
    let state = reduce(undefined, driverSelected("p1"));
    state = reduce(state, driveContextSelected("long"));
    state = reduce(state, driverSelected("p2"));
    expect(selectActiveDriverId(root(state))).toBe("p2");
    expect(selectDriveContext(root(state))).toBe("usual");
  });

  it("운전석에 앉은 사람이 바뀌면 평소로 돌아간다", () => {
    let state = reduce(undefined, driverSelected("p1"));
    state = reduce(state, driveContextSelected("city"));
    state = reduce(state, occupantChanged());
    expect(selectDriveContext(root(state))).toBe("usual");
  });
});
