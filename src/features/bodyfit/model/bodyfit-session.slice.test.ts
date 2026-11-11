import {
  bodyfitSessionSlice,
  driverSelected,
  feedbackProposed,
  occupantChanged,
  selectActiveDriverId,
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
