import { GUIDE_TOLERANCE, guideSeat } from "./bodyfit-guide";

describe("guideSeat", () => {
  it("목표보다 뒤에 있으면 앞으로(increase) 더 가라고 안내한다", () => {
    const guide = guideSeat({ foreAft: 0.4 }, { foreAft: 0.5 });
    expect(guide.axes).toEqual([
      {
        axis: "foreAft",
        current: 0.4,
        target: 0.5,
        status: "more",
        direction: "increase",
        far: false,
      },
    ]);
    expect(guide.focus).toBe("foreAft");
    expect(guide.done).toBe(false);
  });

  it("목표에서 멀면 far 로 표시한다", () => {
    const [axis] = guideSeat({ height: 0.9 }, { height: 0.5 }).axes;
    expect(axis).toMatchObject({ direction: "decrease", far: true });
  });

  it("허용 오차 안이면 맞춘 것으로 본다", () => {
    const guide = guideSeat(
      { backrest: 0.5 + GUIDE_TOLERANCE },
      { backrest: 0.5 },
    );
    expect(guide.axes[0]).toMatchObject({ status: "ok", direction: null });
    expect(guide.done).toBe(true);
    expect(guide.focus).toBeNull();
  });

  it("시작할 때와 반대편으로 넘어가면 지나쳤다고 안내한다", () => {
    const guide = guideSeat(
      { foreAft: 0.6 },
      { foreAft: 0.5 },
      { foreAft: 0.3 },
    );
    expect(guide.axes[0]).toMatchObject({
      status: "overshot",
      direction: "decrease",
    });
  });

  it("시작할 때 이미 맞았던 축이 벗어나면 지나친 것이 아니라 더 가라고 안내한다", () => {
    const guide = guideSeat(
      { foreAft: 0.6 },
      { foreAft: 0.5 },
      { foreAft: 0.5 },
    );
    expect(guide.axes[0]?.status).toBe("more");
  });

  it("앞뒤 → 높이 → 등받이 → 기울기 순서로 아직 안 맞은 첫 축을 안내한다", () => {
    const guide = guideSeat(
      { foreAft: 0.5, height: 0.5, backrest: 0.2, tilt: 0.9 },
      { foreAft: 0.5, height: 0.5, backrest: 0.6, tilt: 0.5 },
    );
    expect(guide.focus).toBe("backrest");
  });

  it("현재 값이나 목표가 없는 축은 건너뛴다", () => {
    const guide = guideSeat(
      { foreAft: 0.5, tilt: 0.2 },
      { foreAft: 0.5, height: 0.4 },
    );
    expect(guide.axes.map((axis) => axis.axis)).toEqual(["foreAft"]);
    expect(guide.done).toBe(true);
  });

  it("비교할 축이 하나도 없으면 다 맞췄다고 하지 않는다", () => {
    expect(guideSeat({}, { foreAft: 0.5 }).done).toBe(false);
  });
});
