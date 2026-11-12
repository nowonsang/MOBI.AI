import {
  bodyfitSessionSlice,
  driveContextSelected,
  driverSelected,
  feedbackProposed,
  occupantChanged,
  selectActiveDriverId,
  selectDriveContext,
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
