import { learnOffsets } from "./bodyfit-learning";
import type { SeatAdjustment } from "./bodyfit.types";

const record = (
  at: number,
  baseline: number,
  final: number,
): SeatAdjustment => ({
  profileId: "p1",
  at,
  baseline: { backrest: baseline },
  final: { backrest: final },
  source: "drive-start",
});

describe("learnOffsets", () => {
  it("기록이 없으면 보정하지 않는다", () => {
    expect(learnOffsets([])).toEqual({});
  });

  it("추천보다 늘 조금 눕혀 앉으면 등받이를 그만큼 눕혀 추천한다", () => {
    const offsets = learnOffsets([
      record(1, 0.6, 0.55),
      record(2, 0.6, 0.55),
      record(3, 0.6, 0.55),
    ]);
    expect(offsets.backrest).toBeCloseTo(-0.05);
  });

  it("최근 기록을 더 크게 반영한다", () => {
    const offsets = learnOffsets([record(1, 0.5, 0.4), record(2, 0.5, 0.6)]);
    expect(offsets.backrest!).toBeGreaterThan(0);
  });

  it("한 번의 극단적인 기록이 추천을 크게 흔들지 않게 보정 폭을 제한한다", () => {
    expect(learnOffsets([record(1, 0, 1)]).backrest).toBe(0.3);
  });

  it("기록이 없는 축은 보정하지 않는다", () => {
    expect(learnOffsets([record(1, 0.5, 0.6)]).foreAft).toBeUndefined();
  });
});
