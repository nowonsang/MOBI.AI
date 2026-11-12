import { GUIDE_TOLERANCE } from "./bodyfit-guide";
import {
  appendSeatAdjustment,
  CONTEXT_FULL_RECORDS,
  explainOffsets,
  learningBasis,
  learnOffsets,
} from "./bodyfit-learning";
import type { DriveContext, SeatAdjustment } from "./bodyfit.types";

const record = (
  at: number,
  baseline: number,
  final: number,
  context: DriveContext = "usual",
): SeatAdjustment => ({
  profileId: "p1",
  at,
  baseline: { backrest: baseline },
  final: { backrest: final },
  source: "drive-start",
  context,
});

describe("learnOffsets", () => {
  it("기록이 없으면 보정하지 않는다", () => {
    expect(learnOffsets([], "usual")).toEqual({});
  });

  it("추천보다 늘 조금 눕혀 앉으면 등받이를 그만큼 눕혀 추천한다", () => {
    const offsets = learnOffsets(
      [record(1, 0.6, 0.55), record(2, 0.6, 0.55), record(3, 0.6, 0.55)],
      "usual",
    );
    expect(offsets.backrest).toBeCloseTo(-0.05);
  });

  it("최근 기록을 더 크게 반영한다", () => {
    const offsets = learnOffsets(
      [record(1, 0.5, 0.4), record(2, 0.5, 0.6)],
      "usual",
    );
    expect(offsets.backrest!).toBeGreaterThan(0);
  });

  it("한 번의 극단적인 기록이 추천을 크게 흔들지 않게 보정 폭을 제한한다", () => {
    expect(learnOffsets([record(1, 0, 1)], "usual").backrest).toBe(0.3);
  });

  it("기록이 없는 축은 보정하지 않는다", () => {
    expect(
      learnOffsets([record(1, 0.5, 0.6)], "usual").foreAft,
    ).toBeUndefined();
  });
});

describe("learnOffsets: 상황별 자세 (C-5)", () => {
  // 평소에는 추천보다 10% 세워 앉고, 장거리에서는 10% 눕혀 앉는 운전자
  const usual = [1, 2, 3].map((at) => record(at, 0.5, 0.6, "usual"));
  const long = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      record(10 + index, 0.5, 0.4, "long"),
    );

  it("고른 상황의 기록이 없으면 전체 기록으로 보정한다", () => {
    expect(learnOffsets(usual, "long")).toEqual(learnOffsets(usual, "usual"));
    expect(learnOffsets(usual, "long").backrest).toBeCloseTo(0.1);
  });

  it("고른 상황의 기록이 충분하면 그 상황의 기록만으로 보정한다", () => {
    const history = [...usual, ...long(CONTEXT_FULL_RECORDS)];
    expect(learnOffsets(history, "long").backrest).toBeCloseTo(-0.1);
    expect(learnOffsets(history, "usual").backrest).toBeCloseTo(0.1);
  });

  it("고른 상황의 기록이 적으면 기록 수만큼만 반영하고 나머지는 전체 기록으로 채운다", () => {
    const history = [...usual, ...long(1)];
    const overall = learnOffsets(history, "city").backrest!;
    const mixed = learnOffsets(history, "long").backrest!;
    // 장거리 기록(-0.1)을 1/3, 전체 기록의 보정값을 2/3 반영한다.
    expect(mixed).toBeCloseTo(
      overall + (-0.1 - overall) / CONTEXT_FULL_RECORDS,
    );
    expect(mixed).toBeLessThan(overall);
    expect(mixed).toBeGreaterThan(-0.1);
  });

  it("기록이 쌓일수록 그 상황의 자세에 가까워진다", () => {
    const one = learnOffsets([...usual, ...long(1)], "long").backrest!;
    const two = learnOffsets([...usual, ...long(2)], "long").backrest!;
    const three = learnOffsets([...usual, ...long(3)], "long").backrest!;
    expect(two).toBeLessThan(one);
    expect(three).toBeLessThan(two);
  });

  it("상황을 고른 적이 없으면(모두 평소) 전체 기록으로 보정한 것과 같다", () => {
    const history = [record(1, 0.5, 0.4), record(2, 0.5, 0.6)];
    const onlyUsual = learnOffsets(history, "usual").backrest!;
    // 기록이 없는 상황은 전체 기록으로 보정하므로 같은 값이 나와야 한다.
    expect(onlyUsual).toBe(learnOffsets(history, "commute").backrest);
  });

  it("그 상황의 기록에 없는 축은 전체 기록의 보정값을 쓴다", () => {
    const history: SeatAdjustment[] = [
      {
        profileId: "p1",
        at: 1,
        baseline: { backrest: 0.5, foreAft: 0.5 },
        final: { backrest: 0.5, foreAft: 0.6 },
        source: "drive-start",
        context: "usual",
      },
      ...long(CONTEXT_FULL_RECORDS),
    ];
    const offsets = learnOffsets(history, "long");
    expect(offsets.backrest).toBeCloseTo(-0.1);
    expect(offsets.foreAft).toBeCloseTo(0.1);
  });

  it("섞어도 보정 폭 제한을 넘지 않는다", () => {
    const history = [
      record(1, 0, 1, "usual"),
      record(2, 0, 1, "usual"),
      record(3, 1, 0, "long"),
    ];
    const offset = learnOffsets(history, "long").backrest!;
    expect(Math.abs(offset)).toBeLessThanOrEqual(0.3);
  });
});

describe("learningBasis", () => {
  it("고른 상황의 기록이 없으면 전체 기록을 바탕으로 한다", () => {
    expect(learningBasis([record(1, 0.5, 0.6)], "long")).toEqual({
      kind: "all",
      contextCount: 0,
      usedCount: 1,
    });
    expect(learningBasis([], "usual")).toEqual({
      kind: "all",
      contextCount: 0,
      usedCount: 0,
    });
  });

  it("고른 상황의 기록이 적으면 전체 기록과 섞는다", () => {
    const history = [
      record(1, 0.5, 0.6),
      record(2, 0.5, 0.6),
      record(3, 0.5, 0.4, "long"),
    ];
    expect(learningBasis(history, "long")).toEqual({
      kind: "mixed",
      contextCount: 1,
      usedCount: 3,
    });
  });

  it("고른 상황의 기록이 충분하면 그 기록만 센다", () => {
    const history = [
      record(1, 0.5, 0.6),
      ...[2, 3, 4].map((at) => record(at, 0.5, 0.4, "long")),
    ];
    expect(learningBasis(history, "long")).toEqual({
      kind: "own",
      contextCount: 3,
      usedCount: 3,
    });
  });

  it("기록이 모두 그 상황의 것이면 적어도 그 기록만 센다", () => {
    expect(learningBasis([record(1, 0.5, 0.6)], "usual")).toEqual({
      kind: "own",
      contextCount: 1,
      usedCount: 1,
    });
  });
});

describe("explainOffsets", () => {
  it("기록이 없으면 이유를 말하지 않는다", () => {
    expect(explainOffsets([], "usual")).toBeNull();
  });

  it("기록이 하나면 지난번 조절을 이유로 든다", () => {
    expect(explainOffsets([record(1, 0.5, 0.6)], "usual")).toBe(
      "지난번에 등받이를 더 세우셔서 반영했어요",
    );
  });

  it("기록이 여럿이면 그동안의 조절을 이유로 든다", () => {
    expect(
      explainOffsets([record(1, 0.6, 0.5), record(2, 0.6, 0.5)], "usual"),
    ).toBe("그동안 등받이를 더 눕히셔서 반영했어요");
  });

  it("가장 크게 보정한 축 하나만 말한다", () => {
    const history: SeatAdjustment[] = [
      {
        profileId: "p1",
        at: 1,
        baseline: { backrest: 0.5, foreAft: 0.5 },
        final: { backrest: 0.55, foreAft: 0.35 },
        source: "drive-start",
        context: "usual",
      },
    ];
    expect(explainOffsets(history, "usual")).toBe(
      "지난번에 시트를 더 뒤로 미셔서 반영했어요",
    );
  });

  it("보정이 가이드 허용 오차보다 작으면 이유를 말하지 않는다", () => {
    expect(
      explainOffsets([record(1, 0.5, 0.5 + GUIDE_TOLERANCE / 2)], "usual"),
    ).toBeNull();
  });

  it("고른 상황의 기록으로 보정했으면 상황을 이유로 든다", () => {
    const history = [
      record(1, 0.5, 0.5, "usual"),
      ...[2, 3, 4].map((at) => record(at, 0.5, 0.4, "long")),
    ];
    expect(explainOffsets(history, "long")).toBe(
      "장거리에서는 등받이를 더 눕히셔서 반영했어요",
    );
  });

  it("상황마다 그 상황을 가리키는 말로 이유를 든다", () => {
    const sat = (context: DriveContext) =>
      [1, 2, 3].map((at) => record(at, 0.5, 0.6, context));
    expect(explainOffsets(sat("commute"), "commute")).toBe(
      "출퇴근할 때는 등받이를 더 세우셔서 반영했어요",
    );
    expect(explainOffsets(sat("city"), "city")).toBe(
      "시내에서는 등받이를 더 세우셔서 반영했어요",
    );
  });

  it("고른 상황의 기록이 없으면 상황을 이유로 들지 않는다", () => {
    const history = [record(1, 0.5, 0.6), record(2, 0.5, 0.6)];
    expect(explainOffsets(history, "long")).toBe(
      "그동안 등받이를 더 세우셔서 반영했어요",
    );
  });

  it("전체 기록에서 온 보정을 상황 탓으로 말하지 않는다", () => {
    // 평소에는 많이 세워 앉고, 장거리에서는 한 번 조금 눕혀 앉았다. 섞은 보정은 여전히 '세움'이다.
    const history = [
      record(1, 0.5, 0.7),
      record(2, 0.5, 0.7),
      record(3, 0.5, 0.7),
      record(4, 0.5, 0.45, "long"),
    ];
    expect(learnOffsets(history, "long").backrest!).toBeGreaterThan(0);
    expect(explainOffsets(history, "long")).toBe(
      "그동안 등받이를 더 세우셔서 반영했어요",
    );
  });

  it("평소는 상황을 이유로 들지 않는다", () => {
    const history = [1, 2, 3].map((at) => record(at, 0.5, 0.6, "usual"));
    expect(explainOffsets(history, "usual")).toBe(
      "그동안 등받이를 더 세우셔서 반영했어요",
    );
  });
});

describe("appendSeatAdjustment", () => {
  const at = (records: readonly SeatAdjustment[]) =>
    records.map((item) => item.at);

  it("새 기록을 목록 끝에 더한다", () => {
    const next = appendSeatAdjustment(
      [record(1, 0.5, 0.6)],
      record(2, 0.5, 0.6),
      50,
    );
    expect(at(next)).toEqual([1, 2]);
  });

  it("같은 운전자·같은 상황의 기록은 최근 것만 남긴다", () => {
    const history = [1, 2, 3].map((time) => record(time, 0.5, 0.6));
    const next = appendSeatAdjustment(history, record(4, 0.5, 0.6), 3);
    expect(at(next)).toEqual([2, 3, 4]);
  });

  it("자주 고르는 상황의 기록이 가끔 고르는 상황의 기록을 밀어내지 않는다", () => {
    const history = [
      record(1, 0.5, 0.4, "long"),
      record(2, 0.5, 0.6, "commute"),
      record(3, 0.5, 0.6, "commute"),
    ];
    const next = appendSeatAdjustment(
      history,
      record(4, 0.5, 0.6, "commute"),
      2,
    );
    expect(next.filter((item) => item.context === "long")).toHaveLength(1);
    expect(at(next.filter((item) => item.context === "commute"))).toEqual([
      3, 4,
    ]);
  });

  it("다른 운전자의 기록은 건드리지 않는다", () => {
    const other: SeatAdjustment = { ...record(1, 0.5, 0.6), profileId: "p2" };
    const next = appendSeatAdjustment(
      [other, record(2, 0.5, 0.6)],
      record(3, 0.5, 0.6),
      1,
    );
    expect(next).toContainEqual(other);
    expect(at(next.filter((item) => item.profileId === "p1"))).toEqual([3]);
  });
});
