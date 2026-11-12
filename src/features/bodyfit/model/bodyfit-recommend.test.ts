import { SEAT_AXES } from "@/shared/pleos/pleos.types";

import {
  BASELINE_AXES,
  isLearnedOnlyAxis,
  LEARNED_ONLY_AXES,
  recommendBaseline,
  recommendSeat,
} from "./bodyfit-recommend";
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
    expect(Object.keys(ratios)).toEqual([...BASELINE_AXES]);
  });

  it("허리 지지대·헤드레스트 각도는 체형으로 추천하지 않는다", () => {
    const ratios: Record<string, number> = recommendBaseline(profile());
    for (const axis of LEARNED_ONLY_AXES) {
      expect(ratios[axis]).toBeUndefined();
    }
  });

  it("모든 축은 기본 추천이 있는 축이거나 기억만 하는 축이다", () => {
    expect([...BASELINE_AXES, ...LEARNED_ONLY_AXES].sort()).toEqual(
      [...SEAT_AXES].sort(),
    );
    expect(isLearnedOnlyAxis("lumbar")).toBe(true);
    expect(isLearnedOnlyAxis("headrestAngle")).toBe(true);
    expect(isLearnedOnlyAxis("headrestHeight")).toBe(false);
  });

  it("극단적인 체형도 0~1 범위를 벗어나지 않는다", () => {
    for (const heightCm of [120, 220]) {
      for (const weightKg of [30, 200]) {
        for (const sittingHeightCm of [null, 60, 120]) {
          const ratios = recommendBaseline(
            profile({ heightCm, weightKg, sittingHeightCm }),
          );
          expect(Object.values(ratios)).toHaveLength(BASELINE_AXES.length);
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

  it("기억한 값이 없으면 허리 지지대·헤드레스트 각도를 추천하지 않는다", () => {
    const result = recommendSeat(profile(), { foreAft: 0.1 });
    expect(result.lumbar).toBeUndefined();
    expect(result.headrestAngle).toBeUndefined();
    expect(Object.keys(result)).toEqual([...BASELINE_AXES]);
  });

  it("기억한 값이 있는 축만 그 값 그대로 추천한다", () => {
    const result = recommendSeat(profile(), {}, { lumbar: 0.62 });
    expect(result.lumbar).toBe(0.62);
    expect(result.headrestAngle).toBeUndefined();
  });

  it("허리 지지대·헤드레스트 각도에는 보정값을 더하지 않고, 기억한 값은 범위 안으로 자른다", () => {
    const result = recommendSeat(
      profile(),
      { lumbar: 0.2, headrestAngle: 0.2 },
      { lumbar: 0.5, headrestAngle: 1.4 },
    );
    expect(result.lumbar).toBe(0.5);
    expect(result.headrestAngle).toBe(1);
  });

  it("기억한 값으로는 체형 추천 축이 달라지지 않는다", () => {
    const base = recommendSeat(profile(), {});
    const result = recommendSeat(profile(), {}, { foreAft: 0.99, lumbar: 0.3 });
    expect(result.foreAft).toBe(base.foreAft);
  });
});
