import {
  autoAdjustReducer,
  countAdjusted,
  initialAutoAdjust,
  planAutoAdjust,
  viewAutoAdjust,
  type AutoAdjustEvent,
  type AutoAdjustState,
} from "./bodyfit-auto-adjust";
import { DEMO_MOVE_STEP } from "./bodyfit-demo-seat";

const target = { foreAft: 0.5, height: 0.4, backrest: 0.6, tilt: 0.5 };
const current = { foreAft: 0.3, height: 0.4, backrest: 0.7, tilt: 0.1 };

const run = (events: AutoAdjustEvent[], from = initialAutoAdjust) =>
  events.reduce(autoAdjustReducer, from);

const statuses = (state: AutoAdjustState) =>
  viewAutoAdjust(state.run!, state.demoSeat).map((axis) => axis.status);

describe("planAutoAdjust", () => {
  it("앞뒤 → 높이 → 등받이 → 기울기 순서로 지금 위치와 목표를 묶는다", () => {
    expect(planAutoAdjust(current, target)).toEqual([
      { axis: "foreAft", start: 0.3, target: 0.5 },
      { axis: "height", start: 0.4, target: 0.4 },
      { axis: "backrest", start: 0.7, target: 0.6 },
      { axis: "tilt", start: 0.1, target: 0.5 },
    ]);
  });

  it("움직일 수 없는 축과 목표가 없는 축은 뺀다", () => {
    expect(
      planAutoAdjust(current, { foreAft: 0.5, tilt: 0.5 }, ["tilt", "height"]),
    ).toEqual([{ axis: "tilt", start: 0.1, target: 0.5 }]);
  });

  it("지금 위치를 모르는 축은 목표에 있는 것으로 본다", () => {
    expect(planAutoAdjust({}, { height: 0.4 })).toEqual([
      { axis: "height", start: 0.4, target: 0.4 },
    ]);
  });
});

describe("autoAdjustReducer: 실제 이동", () => {
  const steps = planAutoAdjust(current, target);
  const moving = run([
    { type: "started" },
    { type: "progressed", steps, completed: 0 },
  ]);

  it("시작하면 계획을 받기 전에도 움직이는 중으로 본다", () => {
    const { run: started } = run([{ type: "started" }]);
    expect(started).toMatchObject({ demo: false, steps: [], outcome: null });
  });

  it("축이 하나씩 끝날 때마다 다음 축이 움직이는 중이 된다", () => {
    expect(statuses(moving)).toEqual([
      "moving",
      "waiting",
      "waiting",
      "waiting",
    ]);
    const next = run([{ type: "progressed", steps, completed: 2 }], moving);
    expect(statuses(next)).toEqual(["done", "done", "moving", "waiting"]);
    expect(countAdjusted(next.run!)).toBe(2);
  });

  it("모든 축이 끝나고 차량 호출이 성공하면 완료다", () => {
    const done = run(
      [
        { type: "progressed", steps, completed: 4 },
        { type: "settled", failed: false, errorCode: null },
      ],
      moving,
    );
    expect(done.run?.outcome).toBe("done");
    expect(statuses(done)).toEqual(["done", "done", "done", "done"]);
    expect(countAdjusted(done.run!)).toBe(4);
  });

  it("멈추기를 누르면 차량이 멈출 때까지 기다렸다가 멈춘 것으로 끝낸다", () => {
    const stopping = run(
      [{ type: "progressed", steps, completed: 1 }, { type: "stopRequested" }],
      moving,
    );
    expect(stopping.run).toMatchObject({ stopping: true, outcome: null });

    // 멈추면 네이티브 호출이 취소(실패)로 끝난다. 실패가 아니라 운전자가 멈춘 것으로 본다.
    const stopped = run(
      [{ type: "settled", failed: true, errorCode: null }],
      stopping,
    );
    expect(stopped.run).toMatchObject({
      stopping: false,
      outcome: "stopped",
      errorCode: null,
    });
    expect(statuses(stopped)).toEqual([
      "done",
      "stopped",
      "waiting",
      "waiting",
    ]);
  });

  it("축 사이에서 멈춰 호출이 성공으로 끝나도 남은 축이 있으면 멈춘 것이다", () => {
    const stopped = run(
      [
        { type: "progressed", steps, completed: 2 },
        { type: "stopRequested" },
        { type: "settled", failed: false, errorCode: null },
      ],
      moving,
    );
    expect(stopped.run?.outcome).toBe("stopped");
  });

  it("차량이 실패하면 이유와 함께 실패로 끝내고 그 축에 표시한다", () => {
    const failed = run(
      [
        { type: "progressed", steps, completed: 1 },
        { type: "settled", failed: true, errorCode: "ERR_NOT_PARKED" },
      ],
      moving,
    );
    expect(failed.run).toMatchObject({
      outcome: "failed",
      errorCode: "ERR_NOT_PARKED",
    });
    expect(statuses(failed)).toEqual(["done", "failed", "waiting", "waiting"]);
  });

  it("끝난 뒤의 진행 보고와 멈추기는 무시한다", () => {
    const done = run(
      [
        { type: "progressed", steps, completed: 4 },
        { type: "settled", failed: false, errorCode: null },
      ],
      moving,
    );
    expect(
      run(
        [
          { type: "progressed", steps, completed: 1 },
          { type: "stopRequested" },
          { type: "settled", failed: true, errorCode: "ERR_SEAT_MOVE_FAILED" },
        ],
        done,
      ),
    ).toBe(done);
  });

  it("움직이는 중에는 닫거나 다시 시작하거나 시연 모드를 바꿀 수 없다", () => {
    expect(
      run(
        [
          { type: "dismissed" },
          { type: "started" },
          { type: "demoStarted", target, from: null },
          { type: "demoToggled" },
        ],
        moving,
      ),
    ).toBe(moving);
  });

  it("끝난 뒤에 닫으면 진행 상태를 지운다", () => {
    const closed = run(
      [
        { type: "settled", failed: true, errorCode: "ERR_SEAT_MOVE_FAILED" },
        { type: "dismissed" },
      ],
      moving,
    );
    expect(closed.run).toBeNull();
  });

  it("차량이 지금 위치를 알려 주면 그 값을, 아니면 시작·목표 위치를 보여 준다", () => {
    const half = run([{ type: "progressed", steps, completed: 1 }], moving);
    const [foreAft, height] = viewAutoAdjust(half.run!, null);
    expect(foreAft).toMatchObject({ current: 0.5, direction: "increase" });
    expect(height).toMatchObject({ current: 0.4, direction: null });
    expect(viewAutoAdjust(half.run!, { backrest: 0.65 })[2]).toMatchObject({
      current: 0.65,
      direction: "decrease",
    });
  });
});

describe("autoAdjustReducer: 시연 모드", () => {
  const demoOn = run([{ type: "demoToggled" }]);
  const tick: AutoAdjustEvent = { type: "ticked", parked: true };
  const ticks = (count: number): AutoAdjustEvent[] => Array(count).fill(tick);

  it("화면에 보이던 자세에서 시작하고, 차량이 알려 주는 축만 움직인다", () => {
    const started = run(
      [{ type: "demoStarted", target, from: { foreAft: 0, height: 0 } }],
      demoOn,
    );
    expect(started.run).toMatchObject({ demo: true, outcome: null });
    expect(started.run?.steps.map((step) => step.axis)).toEqual([
      "foreAft",
      "height",
    ]);
    expect(started.demoSeat).toEqual({ foreAft: 0, height: 0 });
  });

  it("지금 자세를 하나도 모르면 목표에서 어긋난 모의 자세에서 시작한다", () => {
    for (const from of [null, {}]) {
      const started = run([{ type: "demoStarted", target, from }], demoOn);
      expect(started.run?.steps).toHaveLength(4);
      expect(started.demoSeat?.foreAft).toBeCloseTo(0.3);
      expect(started.demoSeat?.backrest).toBeCloseTo(0.52);
    }
  });

  it("한 간격마다 지금 축만 목표 쪽으로 움직인다", () => {
    const moved = run(
      [{ type: "demoStarted", target, from: current }, tick],
      demoOn,
    );
    expect(moved.demoSeat).toEqual({
      ...current,
      foreAft: 0.3 + DEMO_MOVE_STEP,
    });
    expect(statuses(moved)).toEqual([
      "moving",
      "waiting",
      "waiting",
      "waiting",
    ]);
  });

  it("목표에 닿으면 다음 축으로 넘어가고, 모든 축이 닿으면 완료다", () => {
    let state = run([{ type: "demoStarted", target, from: current }], demoOn);
    let count = 0;
    while (state.run?.outcome === null && count < 1000) {
      state = autoAdjustReducer(state, tick);
      count += 1;
    }
    expect(state.run?.outcome).toBe("done");
    expect(state.demoSeat).toEqual(target);
    expect(statuses(state)).toEqual(["done", "done", "done", "done"]);
    // 앞뒤 0.2, 등받이 0.1, 기울기 0.4 만큼 움직이고, 이미 목표에 있는 높이는 한 간격에 넘어간다.
    expect(count).toBe(Math.round((0.2 + 0.1 + 0.4) / DEMO_MOVE_STEP) + 1);
  });

  it("멈추기를 누르면 그 자리에서 바로 멈추고 모의 위치는 그대로 둔다", () => {
    const stopped = run(
      [
        { type: "demoStarted", target, from: current },
        ...ticks(3),
        { type: "stopRequested" },
        tick,
      ],
      demoOn,
    );
    expect(stopped.run?.outcome).toBe("stopped");
    expect(stopped.demoSeat?.foreAft).toBeCloseTo(0.3 + 3 * DEMO_MOVE_STEP);
    expect(statuses(stopped)).toEqual([
      "stopped",
      "waiting",
      "waiting",
      "waiting",
    ]);
  });

  it("움직이는 도중 기어가 P 에서 벗어나면 실제와 같이 멈춘다", () => {
    const blocked = run(
      [
        { type: "demoStarted", target, from: current },
        ...ticks(2),
        { type: "ticked", parked: false },
      ],
      demoOn,
    );
    expect(blocked.run).toMatchObject({
      outcome: "failed",
      errorCode: "ERR_NOT_PARKED",
    });
    expect(blocked.demoSeat?.foreAft).toBeCloseTo(0.3 + 2 * DEMO_MOVE_STEP);
  });

  it("다시 시작하면 지난 시연이 멈춘 자리에서 이어서 움직인다", () => {
    const stopped = run(
      [
        { type: "demoStarted", target, from: current },
        ...ticks(3),
        { type: "stopRequested" },
        { type: "dismissed" },
      ],
      demoOn,
    );
    const again = run(
      [{ type: "demoStarted", target, from: stopped.demoSeat }],
      stopped,
    );
    expect(again.run?.steps[0]).toMatchObject({ axis: "foreAft" });
    expect(again.run?.steps[0].start).toBeCloseTo(0.3 + 3 * DEMO_MOVE_STEP);
  });

  it("시연 모드를 끄면 모의 위치를 버린다", () => {
    const off = run(
      [
        { type: "demoStarted", target, from: current },
        ...ticks(200),
        { type: "dismissed" },
        { type: "demoToggled" },
      ],
      demoOn,
    );
    expect(off).toEqual(initialAutoAdjust);
  });

  it("실제 이동의 진행 보고는 시연에 섞이지 않는다", () => {
    const started = run(
      [{ type: "demoStarted", target, from: current }],
      demoOn,
    );
    expect(
      run(
        [
          { type: "progressed", steps: [], completed: 3 },
          { type: "settled", failed: false, errorCode: null },
        ],
        started,
      ),
    ).toBe(started);
  });
});
