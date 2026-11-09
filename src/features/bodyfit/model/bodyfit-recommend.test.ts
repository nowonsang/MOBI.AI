import { recommendBaseline, recommendSeat } from "./bodyfit-recommend";
import type { BodyProfile } from "./bodyfit.types";

const profile = (overrides: Partial<BodyProfile> = {}): BodyProfile => ({
  id: "p1",
  name: "테스트",
  heightCm: 172,
  weightKg: 68,
  sittingHeightCm: null,
  createdAt: 0,
  ...overrides,
});

describe("recommendBaseline", () => {
  it("키가 클수록 시트를 뒤로 보낸다", () => {
    const short = recommendBaseline(profile({ heightCm: 155 }));
    const tall = recommendBaseline(profile({ heightCm: 190 }));
    expect(tall.foreAft!).toBeLessThan(short.foreAft!);
  });

  it("앉은키가 클수록 시트를 낮춘다", () => {
    const shortTorso = recommendBaseline(profile({ sittingHeightCm: 82 }));
    const longTorso = recommendBaseline(profile({ sittingHeightCm: 98 }));
    expect(longTorso.height!).toBeLessThan(shortTorso.height!);
  });

  it("같은 키라면 체중이 많이 실릴수록 조금 높인다", () => {
    const light = recommendBaseline(profile({ weightKg: 55 }));
    const heavy = recommendBaseline(profile({ weightKg: 95 }));
    expect(heavy.height!).toBeGreaterThan(light.height!);
  });

  it("극단적인 체형도 0~1 범위를 벗어나지 않는다", () => {
    for (const heightCm of [120, 220]) {
      for (const weightKg of [30, 200]) {
        const ratios = recommendBaseline(profile({ heightCm, weightKg }));
        for (const value of Object.values(ratios)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("recommendSeat", () => {
  it("개인 보정을 더하고 범위 안으로 자른다", () => {
    const base = recommendBaseline(profile());
    const result = recommendSeat(profile(), { foreAft: 0.1, height: -2 });
    expect(result.foreAft).toBeCloseTo(base.foreAft! + 0.1);
    expect(result.height).toBe(0);
    expect(result.backrest).toBeCloseTo(base.backrest!);
  });
});
