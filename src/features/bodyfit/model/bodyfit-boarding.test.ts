import { occupancyChanged, shouldReselectDriver } from "./bodyfit-boarding";

describe("occupancyChanged", () => {
  it("처음 알게 된 착좌 값은 기준으로만 삼는다", () => {
    expect(occupancyChanged(null, true)).toBe(false);
    expect(occupancyChanged(null, false)).toBe(false);
  });

  it("앉거나 일어나면 바뀐 것으로 본다", () => {
    expect(occupancyChanged(false, true)).toBe(true);
    expect(occupancyChanged(true, false)).toBe(true);
  });

  it("값이 그대로면 바뀌지 않은 것으로 본다", () => {
    expect(occupancyChanged(true, true)).toBe(false);
    expect(occupancyChanged(false, false)).toBe(false);
  });
});

describe("shouldReselectDriver", () => {
  it("주차 중에 착좌가 바뀌면 운전자를 다시 고르게 한다", () => {
    expect(
      shouldReselectDriver({ changed: true, gear: "park", seatMoving: false }),
    ).toBe(true);
  });

  it("주행 중이거나 기어를 모르면 화면을 바꾸지 않는다", () => {
    for (const gear of [
      "drive",
      "reverse",
      "neutral",
      "unknown",
      null,
    ] as const) {
      expect(
        shouldReselectDriver({ changed: true, gear, seatMoving: false }),
      ).toBe(false);
    }
  });

  it("시트가 움직이는 중에는 멈추기 버튼을 가리지 않게 화면을 바꾸지 않는다", () => {
    expect(
      shouldReselectDriver({ changed: true, gear: "park", seatMoving: true }),
    ).toBe(false);
  });

  it("착좌가 그대로면 화면을 바꾸지 않는다", () => {
    expect(
      shouldReselectDriver({ changed: false, gear: "park", seatMoving: false }),
    ).toBe(false);
  });
});
