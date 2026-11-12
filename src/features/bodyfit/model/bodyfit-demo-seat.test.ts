import {
  DEMO_MOVE_STEP,
  DEMO_STEP,
  driveDemoSeat,
  pressDemoSeat,
  startDemoSeat,
} from "./bodyfit-demo-seat";
import { guideSeat } from "./bodyfit-guide";

const target = { foreAft: 0.5, height: 0.4, backrest: 0.6, tilt: 0.5 };

describe("startDemoSeat", () => {
  it("모든 축을 목표에서 어긋난 곳에서 시작해 안내할 거리가 생긴다", () => {
    const start = startDemoSeat(target);
    const guide = guideSeat(start, target, start);
    expect(guide.axes).toHaveLength(4);
    expect(guide.axes.every((axis) => axis.status === "more")).toBe(true);
    expect(guide.done).toBe(false);
  });

  it("범위 끝에 막히면 반대 방향으로 어긋나게 해 0~1 안에 둔다", () => {
    const start = startDemoSeat({ foreAft: 0.1, height: 0.95 });
    expect(start.foreAft).toBeCloseTo(0.3);
    expect(start.height).toBeCloseTo(0.83);
  });

  it("새 축이 있는 차량이면 일곱 축 모두 어긋난 곳에서 시작한다", () => {
    const full = { ...target, depth: 0.5, headrestHeight: 0.6, beltHeight: 0.5 };
    const start = startDemoSeat(full);
    const guide = guideSeat(start, full, start);
    expect(guide.axes).toHaveLength(7);
    expect(guide.axes.every((axis) => axis.status === "more")).toBe(true);
    for (const value of Object.values(start)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("목표가 없는 축은 만들지 않는다", () => {
    expect(startDemoSeat({ foreAft: 0.5 })).toEqual({ foreAft: 0.3 });
  });
});

describe("pressDemoSeat", () => {
  it("한 번에 DEMO_STEP 만큼 움직이고 다른 축은 그대로 둔다", () => {
    const seat = { foreAft: 0.3, height: 0.5 };
    const pressed = pressDemoSeat(seat, "foreAft", "increase");
    expect(pressed.foreAft).toBeCloseTo(0.3 + DEMO_STEP);
    expect(pressed.height).toBe(0.5);
    expect(pressDemoSeat(seat, "height", "decrease").height).toBeCloseTo(0.46);
  });

  it("범위 밖으로 나가지 않는다", () => {
    expect(pressDemoSeat({ tilt: 0.98 }, "tilt", "increase").tilt).toBe(1);
    expect(pressDemoSeat({ tilt: 0.01 }, "tilt", "decrease").tilt).toBe(0);
  });

  it("값이 없는 축은 무시한다", () => {
    const seat = { foreAft: 0.3 };
    expect(pressDemoSeat(seat, "height", "increase")).toBe(seat);
  });

  it.each([
    ["기본 네 축", target],
    [
      "일곱 축",
      { ...target, depth: 0.2, headrestHeight: 0.1, beltHeight: 0.95 },
    ],
  ])("안내대로 누르면 모든 축을 맞춰 완료된다 (%s)", (_name, goal) => {
    const start = startDemoSeat(goal);
    let seat = start;
    for (let i = 0; i < 80; i += 1) {
      const guide = guideSeat(seat, goal, start);
      const focus = guide.axes.find((axis) => axis.axis === guide.focus);
      if (!focus?.direction) break;
      seat = pressDemoSeat(seat, focus.axis, focus.direction);
    }
    expect(guideSeat(seat, goal, start).done).toBe(true);
  });
});

describe("driveDemoSeat", () => {
  it("목표 쪽으로 한 간격만큼 움직이고 다른 축은 그대로 둔다", () => {
    const seat = { foreAft: 0.3, backrest: 0.7 };
    expect(driveDemoSeat(seat, "foreAft", 0.5)).toEqual({
      foreAft: 0.3 + DEMO_MOVE_STEP,
      backrest: 0.7,
    });
    expect(driveDemoSeat(seat, "backrest", 0.5).backrest).toBeCloseTo(
      0.7 - DEMO_MOVE_STEP,
    );
  });

  it("목표를 지나치지 않고 목표에서 멈춘다", () => {
    expect(driveDemoSeat({ height: 0.395 }, "height", 0.4).height).toBe(0.4);
    expect(driveDemoSeat({ height: 0.4 }, "height", 0.4).height).toBe(0.4);
  });

  it("목표가 범위 밖이면 범위 끝까지만 간다", () => {
    expect(driveDemoSeat({ tilt: 0.995 }, "tilt", 1.4).tilt).toBe(1);
  });

  it("값이 없는 축은 무시한다", () => {
    const seat = { foreAft: 0.3 };
    expect(driveDemoSeat(seat, "height", 0.5)).toBe(seat);
  });
});

describe("startDemoSeat: 허리 지지대·헤드레스트 각도", () => {
  it("목표(기억한 값)가 있을 때만 어긋난 시작 위치를 만든다", () => {
    expect(startDemoSeat(target).lumbar).toBeUndefined();
    const start = startDemoSeat({ lumbar: 0.5, headrestAngle: 0.95 });
    expect(start.lumbar).not.toBe(0.5);
    expect(start.headrestAngle).not.toBe(0.95);
    for (const value of Object.values(start)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
