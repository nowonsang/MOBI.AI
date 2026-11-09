import { z } from "zod";

export const bodyProfileInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "운전자 이름을 입력해 주세요")
    .max(20, "이름은 20자 이내로 입력해 주세요"),
  heightCm: z
    .number({ error: "키를 숫자로 입력해 주세요" })
    .min(120, "키는 120~220cm 사이로 입력해 주세요")
    .max(220, "키는 120~220cm 사이로 입력해 주세요"),
  weightKg: z
    .number({ error: "몸무게를 숫자로 입력해 주세요" })
    .min(30, "몸무게는 30~200kg 사이로 입력해 주세요")
    .max(200, "몸무게는 30~200kg 사이로 입력해 주세요"),
  sittingHeightCm: z
    .number()
    .min(60, "앉은키는 60~120cm 사이로 입력해 주세요")
    .max(120, "앉은키는 60~120cm 사이로 입력해 주세요")
    .nullable(),
});

export const bodyProfileSchema = bodyProfileInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.number(),
});

const ratio = z.number().min(0).max(1);

export const seatRatiosSchema = z.object({
  foreAft: ratio.optional(),
  height: ratio.optional(),
  backrest: ratio.optional(),
  tilt: ratio.optional(),
});

export const seatAdjustmentSchema = z.object({
  profileId: z.string().min(1),
  at: z.number(),
  baseline: seatRatiosSchema,
  final: seatRatiosSchema,
  source: z.enum(["drive-start", "voice", "saved"]),
});
