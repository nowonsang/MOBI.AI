import { parseMeasurement } from "./bodyfit-drive";
import {
  SEAT_REREAD_LIMIT,
  applyNudges,
  shouldRereadSeat,
  toSeatRatios,
  toSeatTargets,
} from "./bodyfit-seat";

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

describe("새 축 (좌판 길이·헤드레스트·안전벨트 높이)", () => {
  const extended = {
    ...state,
    depth: { value: 30, min: 0, max: 60, movable: true },
    headrestHeight: { value: 2, min: 0, max: 8, movable: false },
    beltHeight: { value: 100, min: 100, max: 100, movable: true },
  };

  it("차량이 알려 주는 새 축도 비율로 바꾸고, 범위가 0 인 축은 뺀다", () => {
    expect(toSeatRatios(extended)).toEqual({
      foreAft: 0.25,
      height: 0.25,
      tilt: 0.5,
      depth: 0.5,
      headrestHeight: 0.25,
    });
  });

  it("자세 축을 먼저, 새 축을 뒤에 움직이고 움직일 수 없는 축은 뺀다", () => {
    expect(
      toSeatTargets(
        { depth: 0.75, foreAft: 0.5, headrestHeight: 0.5, beltHeight: 0.5 },
        extended,
      ),
    ).toEqual([
      { axis: "foreAft", target: 100 },
      { axis: "depth", target: 45 },
      { axis: "beltHeight", target: 100 },
    ]);
  });

  it("차량이 알려 주지 않는 새 축은 추천이 있어도 움직이지 않는다", () => {
    expect(
      toSeatTargets(
        { foreAft: 0.5, depth: 0.7, headrestHeight: 0.6, beltHeight: 0.5 },
        state,
      ),
    ).toEqual([{ axis: "foreAft", target: 100 }]);
  });

  it("새 축만 읽힌 상태도 빈 상태가 아니므로 다시 읽지 않는다", () => {
    expect(shouldRereadSeat({ depth: extended.depth }, 1)).toBe(false);
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

describe("shouldRereadSeat", () => {
  it("축을 하나도 읽지 못한 빈 상태면 다시 읽는다 (앱을 켠 직후)", () => {
    expect(shouldRereadSeat({}, 1)).toBe(true);
  });

  it("축을 하나라도 읽었으면 다시 읽지 않는다", () => {
    expect(shouldRereadSeat({ foreAft: state.foreAft }, 1)).toBe(false);
  });

  it("아직 한 번도 읽지 않았으면 다시 읽기를 예약하지 않는다", () => {
    expect(shouldRereadSeat(undefined, 0)).toBe(false);
  });

  it("정해진 횟수까지만 다시 읽는다 (축이 없는 차량에서 끝없이 읽지 않게)", () => {
    expect(shouldRereadSeat({}, SEAT_REREAD_LIMIT - 1)).toBe(true);
    expect(shouldRereadSeat({}, SEAT_REREAD_LIMIT)).toBe(false);
  });
});

describe("허리 지지대·헤드레스트 각도", () => {
  const withSupport = {
    ...state,
    lumbar: { value: 20, min: 0, max: 80, movable: true },
    headrestAngle: { value: 3, min: 0, max: 6, movable: false },
  };

  it("차량이 알려 주면 비율로 바꾼다", () => {
    const ratios = toSeatRatios(withSupport);
    expect(ratios.lumbar).toBe(0.25);
    expect(ratios.headrestAngle).toBe(0.5);
  });

  it("추천에 없는 축(기록이 쌓이기 전)은 움직일 수 있어도 움직이지 않는다", () => {
    expect(toSeatTargets({ foreAft: 0.5 }, withSupport)).toEqual([
      { axis: "foreAft", target: 100 },
    ]);
  });

  it("기억한 값이 있으면 자세 축 뒤에 움직이고, 움직일 수 없는 축은 뺀다", () => {
    expect(
      toSeatTargets(
        { lumbar: 0.5, headrestAngle: 0.5, foreAft: 0.5 },
        withSupport,
      ),
    ).toEqual([
      { axis: "foreAft", target: 100 },
      { axis: "lumbar", target: 40 },
    ]);
  });

  it("범위를 벗어난 목표는 차량이 알려 준 범위로 자른다", () => {
    expect(toSeatTargets({ lumbar: 1.5 }, withSupport)).toEqual([
      { axis: "lumbar", target: 80 },
    ]);
  });
});
