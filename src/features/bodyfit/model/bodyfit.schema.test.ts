import { z } from "zod";

import { bodyProfileSchema, driveSessionSchema } from "./bodyfit.schema";

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
  it("누가 언제 출발했는지 읽는다", () => {
    expect(
      driveSessionSchema.parse({ profileId: "p1", startedAt: 1_000 }),
    ).toEqual({ profileId: "p1", startedAt: 1_000 });
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
