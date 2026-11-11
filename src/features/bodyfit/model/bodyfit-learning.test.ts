import { GUIDE_TOLERANCE } from "./bodyfit-guide";
import { explainOffsets, learnOffsets } from "./bodyfit-learning";
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

describe("explainOffsets", () => {
  it("기록이 없으면 이유를 말하지 않는다", () => {
    expect(explainOffsets([])).toBeNull();
  });

  it("기록이 하나면 지난번 조절을 이유로 든다", () => {
    expect(explainOffsets([record(1, 0.5, 0.6)])).toBe(
      "지난번에 등받이를 더 세우셔서 반영했어요",
    );
  });

  it("기록이 여럿이면 그동안의 조절을 이유로 든다", () => {
    expect(explainOffsets([record(1, 0.6, 0.5), record(2, 0.6, 0.5)])).toBe(
      "그동안 등받이를 더 눕히셔서 반영했어요",
    );
  });

  it("가장 크게 보정한 축 하나만 말한다", () => {
    const history: SeatAdjustment[] = [
      {
        profileId: "p1",
        at: 1,
        baseline: { backrest: 0.5, foreAft: 0.5 },
        final: { backrest: 0.55, foreAft: 0.35 },
        source: "drive-start",
      },
    ];
    expect(explainOffsets(history)).toBe(
      "지난번에 시트를 더 뒤로 미셔서 반영했어요",
    );
  });

  it("보정이 가이드 허용 오차보다 작으면 이유를 말하지 않는다", () => {
    expect(
      explainOffsets([record(1, 0.5, 0.5 + GUIDE_TOLERANCE / 2)]),
    ).toBeNull();
  });
});
