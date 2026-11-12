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

  it("자세 네 축을 다 맞춘 뒤에 좌판 길이 → 헤드레스트 → 안전벨트를 안내한다", () => {
    const target = {
      foreAft: 0.5,
      height: 0.5,
      backrest: 0.6,
      tilt: 0.5,
      depth: 0.5,
      headrestHeight: 0.6,
      beltHeight: 0.5,
    };
    const seated = { ...target, depth: 0.3, headrestHeight: 0.2, beltHeight: 0.9 };
    expect(guideSeat(seated, target).focus).toBe("depth");
    expect(guideSeat({ ...seated, depth: 0.5 }, target).focus).toBe(
      "headrestHeight",
    );
    const last = guideSeat(
      { ...seated, depth: 0.5, headrestHeight: 0.6 },
      target,
    );
    expect(last.focus).toBe("beltHeight");
    expect(last.axes).toHaveLength(7);
    expect(last.done).toBe(false);
  });

  it("차량이 알려 주지 않는 새 축은 추천이 있어도 안내하지 않고, 나머지를 맞추면 완료다", () => {
    const guide = guideSeat(
      { foreAft: 0.5, height: 0.5 },
      { foreAft: 0.5, height: 0.5, depth: 0.4, headrestHeight: 0.6, beltHeight: 0.5 },
    );
    expect(guide.axes.map((axis) => axis.axis)).toEqual(["foreAft", "height"]);
    expect(guide.done).toBe(true);
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

describe("guideSeat: 허리 지지대·헤드레스트 각도", () => {
  const posture = { foreAft: 0.5, height: 0.4, backrest: 0.6, tilt: 0.5 };

  it("기억한 값이 없으면(목표가 없으면) 차량이 위치를 알려 줘도 안내하지 않는다", () => {
    const guide = guideSeat({ ...posture, lumbar: 0.1 }, posture);
    expect(guide.axes.map((axis) => axis.axis)).not.toContain("lumbar");
    expect(guide.done).toBe(true);
  });

  it("기억한 값이 있으면 다른 축을 다 맞춘 뒤 마지막에 안내한다", () => {
    const target = { ...posture, lumbar: 0.6, headrestAngle: 0.5 };
    const guide = guideSeat(
      { ...posture, foreAft: 0.2, lumbar: 0.3, headrestAngle: 0.5 },
      target,
    );
    expect(guide.focus).toBe("foreAft");
    const settled = guideSeat(
      { ...posture, lumbar: 0.3, headrestAngle: 0.5 },
      target,
    );
    expect(settled.focus).toBe("lumbar");
    expect(settled.done).toBe(false);
  });
});
