import { z } from "zod";

import { POSE_LANDMARK_NAMES } from "@/shared/pose-camera/pose-camera.types";

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

/** 키·앉은키 입력 범위 (cm). 카메라 추정(bodyfit-body-scan.ts)도 같은 범위로 자른다. */
export const HEIGHT_CM_RANGE = { min: 120, max: 220 } as const;
export const SITTING_HEIGHT_CM_RANGE = { min: 60, max: 120 } as const;

export const bodyProfileInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "운전자 이름을 입력해 주세요")
    .max(20, "이름은 20자 이내로 입력해 주세요"),
  heightCm: z
    .number({ error: "키를 숫자로 입력해 주세요" })
    .min(HEIGHT_CM_RANGE.min, "키는 120~220cm 사이로 입력해 주세요")
    .max(HEIGHT_CM_RANGE.max, "키는 120~220cm 사이로 입력해 주세요"),
  weightKg: z
    .number({ error: "몸무게를 숫자로 입력해 주세요" })
    .min(30, "몸무게는 30~200kg 사이로 입력해 주세요")
    .max(200, "몸무게는 30~200kg 사이로 입력해 주세요"),
  sittingHeightCm: z
    .number()
    .min(SITTING_HEIGHT_CM_RANGE.min, "앉은키는 60~120cm 사이로 입력해 주세요")
    .max(SITTING_HEIGHT_CM_RANGE.max, "앉은키는 60~120cm 사이로 입력해 주세요")
    .nullable(),
  // 선택 동의. 거부해도 화면만으로 모든 기능을 쓸 수 있다.
  voiceConsent: z.boolean(),
  // 주행 중 카메라로 자세 살펴보기(C-7) 선택 동의. 동의 칸이 생기기 전 운전자는 동의하지 않은 것으로 읽는다.
  postureConsent: z.boolean().default(false),
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
  source: z.enum(["drive-start", "voice", "saved", "touch", "camera"]),
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

// 주행 중 자세 관찰 값 (카메라 분석이 넘겨준다). 사람 몸이 앉은 채로 움직일 수 없는 값은 받지 않는다.
const POSTURE_MAX_MINUTES = 24 * 60;

export const postureSampleSchema = z.object({
  minute: z.number().min(0).max(POSTURE_MAX_MINUTES),
  headForwardCm: z.number().min(-40).max(40),
  shoulderDropCm: z.number().min(-40).max(40),
  backLeanDeg: z.number().min(-60).max(60),
});

export const postureDriveSchema = z.object({
  profileId: z.string().min(1),
  startedAt: z.number(),
  context: driveContext,
  durationMin: z.number().min(1).max(POSTURE_MAX_MINUTES),
  // 1분에 한 번씩 남겨도 하루치를 넘지 않는다
  samples: z.array(postureSampleSchema).max(POSTURE_MAX_MINUTES),
  sample: z.boolean().default(false),
});

// 카메라(네이티브)에서 온 관절 표본. 신뢰하지 않는 입력이라 형식과 범위를 검사한다 (C-7).
const finite = z.number().finite();
export const poseSampleSchema = z.object({
  at: finite,
  width: finite.positive(),
  height: finite.positive(),
  landmarks: z
    .array(
      z.object({
        name: z.enum(POSE_LANDMARK_NAMES),
        x: finite,
        y: finite,
        likelihood: finite.min(0).max(1),
      }),
    )
    .max(POSE_LANDMARK_NAMES.length),
});
