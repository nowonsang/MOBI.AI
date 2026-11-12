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
  // 선택 동의. 거부해도 화면만으로 모든 기능을 쓸 수 있다.
  voiceConsent: z.boolean(),
});

// 저장된 목록은 배열 전체를 한 번에 검증한다. 동의 필드가 생기기 전에 저장된 운전자 하나 때문에
// 목록 전체가 비지 않도록, 예전 기록은 기본값(음성 미동의, 동의 시각 0 = 기록 없음)으로 읽는다.
export const bodyProfileSchema = bodyProfileInputSchema.extend({
  voiceConsent: z.boolean().default(false),
  id: z.string().min(1),
  createdAt: z.number(),
  /** 필수 동의(체형 정보 수집·이용)를 받은 시각. 0 이면 동의 화면 이전에 등록된 운전자다. */
  consentedAt: z.number().default(0),
});

const ratio = z.number().min(0).max(1);

export const seatRatiosSchema = z.object({
  foreAft: ratio.optional(),
  height: ratio.optional(),
  backrest: ratio.optional(),
  tilt: ratio.optional(),
});

export const driveSessionSchema = z.object({
  profileId: z.string().min(1),
  startedAt: z.number(),
});

export const seatAdjustmentSchema = z.object({
  profileId: z.string().min(1),
  at: z.number(),
  baseline: seatRatiosSchema,
  final: seatRatiosSchema,
  source: z.enum(["drive-start", "voice", "saved", "touch"]),
});

// 차량 단계 값은 차종마다 범위가 달라 정수인지만 확인한다. 온도는 사람이 쓰는 범위로 막는다.
const heatLevel = z.number().int().min(-10).max(10);
const celsius = z.number().min(-40).max(60);

export const comfortSettingsSchema = z.object({
  seatHeat: heatLevel.optional(),
  steeringHeat: heatLevel.optional(),
  cabinTarget: celsius.optional(),
});

export const comfortRecordSchema = z.object({
  profileId: z.string().min(1),
  at: z.number(),
  cabinTemp: celsius.nullable(),
  settings: comfortSettingsSchema,
});
