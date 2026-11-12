import { z } from "zod";

import {
  AMBIENT_BRIGHTNESS_RANGE,
  AMBIENT_COLOR_RANGE,
  CABIN_TARGET_RANGE,
  CABIN_TEMP_RANGE,
  FAN_DIRECTIONS,
  FAN_SPEED_RANGE,
  HEAT_LEVEL_RANGE,
  MIRROR_HEAT_RANGE,
  VENT_LEVEL_RANGE,
} from "./bodyfit-comfort";
import { DEFAULT_DRIVE_CONTEXT, DRIVE_CONTEXTS } from "./bodyfit-drive-context";

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
  depth: ratio.optional(),
  headrestHeight: ratio.optional(),
  beltHeight: ratio.optional(),
  lumbar: ratio.optional(),
  headrestAngle: ratio.optional(),
});

// 상황(C-5)이 생기기 전에 저장된 기록·주행은 평소로 읽는다 (예전 기록 때문에 목록 전체가 비지 않게).
const driveContext = z.enum(DRIVE_CONTEXTS).default(DEFAULT_DRIVE_CONTEXT);

export const driveSessionSchema = z.object({
  profileId: z.string().min(1),
  startedAt: z.number(),
  context: driveContext,
});

export const seatAdjustmentSchema = z.object({
  profileId: z.string().min(1),
  at: z.number(),
  baseline: seatRatiosSchema,
  final: seatRatiosSchema,
  source: z.enum(["drive-start", "voice", "saved", "touch"]),
  context: driveContext,
});

// 범위는 기록할 때 쓰는 것과 같은 상수다 (bodyfit-comfort.ts). 기록할 때 범위 밖 값을 빼므로 읽을 때 목록 전체가 버려지지 않는다.
const heatLevel = z
  .number()
  .int()
  .min(HEAT_LEVEL_RANGE.min)
  .max(HEAT_LEVEL_RANGE.max);

// 통풍·풍량·바람 방향은 나중에 더한 항목이다. 모두 선택 값이라 이 항목이 없는 예전 기록도 그대로 읽힌다.
export const comfortSettingsSchema = z.object({
  seatHeat: heatLevel.optional(),
  seatVent: z
    .number()
    .int()
    .min(VENT_LEVEL_RANGE.min)
    .max(VENT_LEVEL_RANGE.max)
    .optional(),
  steeringHeat: heatLevel.optional(),
  cabinTarget: z
    .number()
    .min(CABIN_TARGET_RANGE.min)
    .max(CABIN_TARGET_RANGE.max)
    .optional(),
  fanSpeed: z
    .number()
    .int()
    .min(FAN_SPEED_RANGE.min)
    .max(FAN_SPEED_RANGE.max)
    .optional(),
  fanDirection: z.enum(FAN_DIRECTIONS).optional(),
  mirrorHeat: z
    .number()
    .int()
    .min(MIRROR_HEAT_RANGE.min)
    .max(MIRROR_HEAT_RANGE.max)
    .optional(),
  ambientOn: z.boolean().optional(),
  ambientBrightness: z
    .number()
    .int()
    .min(AMBIENT_BRIGHTNESS_RANGE.min)
    .max(AMBIENT_BRIGHTNESS_RANGE.max)
    .optional(),
  ambientColor: z
    .number()
    .int()
    .min(AMBIENT_COLOR_RANGE.min)
    .max(AMBIENT_COLOR_RANGE.max)
    .optional(),
});

export const comfortRecordSchema = z.object({
  profileId: z.string().min(1),
  at: z.number(),
  cabinTemp: z
    .number()
    .min(CABIN_TEMP_RANGE.min)
    .max(CABIN_TEMP_RANGE.max)
    .nullable(),
  settings: comfortSettingsSchema,
});
