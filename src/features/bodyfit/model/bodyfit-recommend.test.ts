import { SEAT_AXES } from "@/shared/pleos/pleos.types";

import { recommendBaseline, recommendSeat } from "./bodyfit-recommend";
import type { BodyProfile } from "./bodyfit.types";

const profile = (overrides: Partial<BodyProfile> = {}): BodyProfile => ({
  id: "p1",
  name: "테스트",
  heightCm: 172,
  weightKg: 68,
  sittingHeightCm: null,
  voiceConsent: false,
  createdAt: 0,
  consentedAt: 0,
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

  it("다리가 길수록 좌판을 길게 뺀다", () => {
    const short = recommendBaseline(profile({ heightCm: 155 }));
    const tall = recommendBaseline(profile({ heightCm: 190 }));
    expect(tall.depth!).toBeGreaterThan(short.depth!);
  });

  it("같은 키라도 상체가 길면(다리가 짧으면) 좌판을 덜 뺀다", () => {
    const longLegs = recommendBaseline(profile({ sittingHeightCm: 86 }));
    const longTorso = recommendBaseline(profile({ sittingHeightCm: 96 }));
    expect(longTorso.depth!).toBeLessThan(longLegs.depth!);
  });

  it("앉은키가 클수록 헤드레스트와 안전벨트를 높인다", () => {
    const shortTorso = recommendBaseline(profile({ sittingHeightCm: 82 }));
    const longTorso = recommendBaseline(profile({ sittingHeightCm: 98 }));
    expect(longTorso.headrestHeight!).toBeGreaterThan(
      shortTorso.headrestHeight!,
    );
    expect(longTorso.beltHeight!).toBeGreaterThan(shortTorso.beltHeight!);
  });

  it("안전벨트는 헤드레스트보다 완만하게 올린다 (시트 높이 추천이 어깨 높이 차이를 줄인다)", () => {
    const shortTorso = recommendBaseline(profile({ sittingHeightCm: 82 }));
    const longTorso = recommendBaseline(profile({ sittingHeightCm: 98 }));
    expect(longTorso.beltHeight! - shortTorso.beltHeight!).toBeLessThan(
      longTorso.headrestHeight! - shortTorso.headrestHeight!,
    );
  });

  it("앉은키를 모르면 키로 추정해 새 축도 추천한다", () => {
    const ratios = recommendBaseline(profile({ sittingHeightCm: null }));
    expect(Object.keys(ratios)).toEqual([...SEAT_AXES]);
  });

  it("극단적인 체형도 0~1 범위를 벗어나지 않는다", () => {
    for (const heightCm of [120, 220]) {
      for (const weightKg of [30, 200]) {
        for (const sittingHeightCm of [null, 60, 120]) {
          const ratios = recommendBaseline(
            profile({ heightCm, weightKg, sittingHeightCm }),
          );
          expect(Object.values(ratios)).toHaveLength(SEAT_AXES.length);
          for (const value of Object.values(ratios)) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
          }
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

  it("네 축만 있는 예전 기록의 보정으로는 새 축 추천이 달라지지 않는다", () => {
    const base = recommendBaseline(profile());
    const result = recommendSeat(profile(), { foreAft: 0.1, tilt: -0.05 });
    expect(result.depth).toBeCloseTo(base.depth!);
    expect(result.headrestHeight).toBeCloseTo(base.headrestHeight!);
    expect(result.beltHeight).toBeCloseTo(base.beltHeight!);
  });

  it("새 축의 개인 보정도 더하고 범위 안으로 자른다", () => {
    const base = recommendBaseline(profile());
    const result = recommendSeat(profile(), {
      depth: 0.1,
      headrestHeight: 2,
      beltHeight: -2,
    });
    expect(result.depth).toBeCloseTo(base.depth! + 0.1);
    expect(result.headrestHeight).toBe(1);
    expect(result.beltHeight).toBe(0);
  });
});
