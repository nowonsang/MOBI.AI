import { parseMeasurement } from "./bodyfit-drive";
import { applyNudges, toSeatRatios, toSeatTargets } from "./bodyfit-seat";

const state = {
  foreAft: { value: 50, min: 0, max: 200, movable: true },
  height: { value: -10, min: -20, max: 20, movable: true },
  backrest: { value: 3, min: 3, max: 3, movable: true },
  tilt: { value: 5, min: 0, max: 10, movable: false },
};

describe("toSeatRatios", () => {
  it("원시 값을 범위 안 비율로 바꾸고, 범위가 0 인 축은 뺀다", () => {
    expect(toSeatRatios(state)).toEqual({
      foreAft: 0.25,
      height: 0.25,
      tilt: 0.5,
    });
  });
});

describe("toSeatTargets", () => {
  it("움직일 수 있는 축만 원시 목표값으로 바꾼다", () => {
    expect(toSeatTargets({ foreAft: 0.5, height: 1.4, tilt: 0.2 }, state)).toEqual([
      { axis: "foreAft", target: 100 },
      { axis: "height", target: 20 },
    ]);
  });
});

describe("applyNudges", () => {
  it("조절량을 더하고 0~1 로 자른다", () => {
    expect(
      applyNudges({ foreAft: 0.5, height: 0.98 }, [
        { axis: "foreAft", direction: "decrease", amount: "medium" },
        { axis: "height", direction: "increase", amount: "small" },
        { axis: "tilt", direction: "increase", amount: "small" },
      ]),
    ).toEqual({ foreAft: 0.42, height: 1 });
  });
});

describe("parseMeasurement", () => {
  it.each([
    ["175", 175],
    ["175cm", 175],
    [" 175.5 ", 175.5],
    ["175,5", 175.5],
  ])("%s → %d", (input, expected) => {
    expect(parseMeasurement(input)).toBe(expected);
  });

  it("숫자가 없으면 NaN", () => {
    expect(parseMeasurement("모름")).toBeNaN();
  });
});
