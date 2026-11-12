import { z } from "zod";

import {
  bodyProfileSchema,
  driveSessionSchema,
  seatAdjustmentSchema,
} from "./bodyfit.schema";

const legacyProfile = {
  id: "p1",
  name: "테스트",
  heightCm: 172,
  weightKg: 68,
  sittingHeightCm: null,
  createdAt: 0,
};

describe("bodyProfileSchema", () => {
  it("동의 필드가 생기기 전에 저장된 운전자도 읽는다", () => {
    const parsed = bodyProfileSchema.parse(legacyProfile);
    expect(parsed.voiceConsent).toBe(false);
    expect(parsed.consentedAt).toBe(0);
  });

  it("예전 운전자가 섞여 있어도 목록 전체가 비지 않는다", () => {
    const current = {
      ...legacyProfile,
      id: "p2",
      voiceConsent: true,
      consentedAt: 1,
    };
    const parsed = z
      .array(bodyProfileSchema)
      .safeParse([legacyProfile, current]);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toHaveLength(2);
  });
});

describe("seatAdjustmentSchema", () => {
  const legacyRecord = {
    profileId: "p1",
    at: 1,
    baseline: { foreAft: 0.5, height: 0.5, backrest: 0.6, tilt: 0.5 },
    final: { foreAft: 0.4, height: 0.5, backrest: 0.6, tilt: 0.5 },
    source: "drive-start",
  };

  // 상황이 없는 예전 기록은 "평소"로 읽는다 (C-5).
  it("네 축만 있는 예전 기록을 그대로 읽는다", () => {
    expect(seatAdjustmentSchema.parse(legacyRecord)).toEqual({
      ...legacyRecord,
      context: "usual",
    });
  });

  it("좌판 길이·헤드레스트·안전벨트 높이가 든 기록을 버리지 않고 읽는다", () => {
    const record = {
      ...legacyRecord,
      baseline: {
        ...legacyRecord.baseline,
        depth: 0.5,
        headrestHeight: 0.6,
        beltHeight: 0.4,
      },
      final: { ...legacyRecord.final, depth: 0.55, beltHeight: 0.35 },
    };
    expect(seatAdjustmentSchema.parse(record)).toEqual({
      ...record,
      context: "usual",
    });
  });

  it("예전 기록과 새 기록이 섞여 있어도 목록 전체가 비지 않는다", () => {
    const parsed = z
      .array(seatAdjustmentSchema)
      .safeParse([
        legacyRecord,
        { ...legacyRecord, at: 2, final: { depth: 0.3 } },
      ]);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toHaveLength(2);
  });

  it("범위를 벗어난 새 축 값은 받지 않는다", () => {
    expect(
      seatAdjustmentSchema.safeParse({
        ...legacyRecord,
        final: { headrestHeight: 1.2 },
      }).success,
    ).toBe(false);
  });
});

describe("driveSessionSchema", () => {
  it("누가 언제 어떤 상황으로 출발했는지 읽는다", () => {
    expect(
      driveSessionSchema.parse({
        profileId: "p1",
        startedAt: 1_000,
        context: "long",
      }),
    ).toEqual({ profileId: "p1", startedAt: 1_000, context: "long" });
  });

  it("상황이 생기기 전에 저장된 주행은 평소로 읽는다", () => {
    expect(
      driveSessionSchema.parse({ profileId: "p1", startedAt: 1_000 }),
    ).toEqual({ profileId: "p1", startedAt: 1_000, context: "usual" });
  });

  it("운전자나 출발 시각이 없는 저장 값은 받지 않는다", () => {
    expect(driveSessionSchema.safeParse({ startedAt: 1_000 }).success).toBe(
      false,
    );
    expect(
      driveSessionSchema.safeParse({ profileId: "", startedAt: 1_000 }).success,
    ).toBe(false);
    expect(
      driveSessionSchema.safeParse({ profileId: "p1", startedAt: "어제" })
        .success,
    ).toBe(false);
  });
});

describe("seatAdjustmentSchema", () => {
  const legacyAdjustment = {
    profileId: "p1",
    at: 1_000,
    baseline: { backrest: 0.6 },
    final: { backrest: 0.55 },
    source: "drive-start",
  };

  it("상황이 생기기 전에 저장된 자세 기록은 평소로 읽는다", () => {
    expect(seatAdjustmentSchema.parse(legacyAdjustment).context).toBe("usual");
  });

  it("예전 기록이 섞여 있어도 목록 전체가 비지 않는다", () => {
    const parsed = z
      .array(seatAdjustmentSchema)
      .safeParse([legacyAdjustment, { ...legacyAdjustment, context: "long" }]);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.map((record) => record.context)).toEqual([
      "usual",
      "long",
    ]);
  });

  it("모르는 상황이 적힌 기록은 받지 않는다", () => {
    expect(
      seatAdjustmentSchema.safeParse({
        ...legacyAdjustment,
        context: "highway",
      }).success,
    ).toBe(false);
  });
});
