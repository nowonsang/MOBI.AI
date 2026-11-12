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
