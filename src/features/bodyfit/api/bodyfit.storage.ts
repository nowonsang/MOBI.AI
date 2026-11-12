import { z } from "zod";

import {
  getEncryptedItem,
  removeEncryptedItem,
  setEncryptedItem,
} from "@/shared/storage/encrypted-storage";

import {
  bodyProfileSchema,
  comfortRecordSchema,
  driveSessionSchema,
  seatAdjustmentSchema,
} from "../model/bodyfit.schema";
import type {
  BodyProfile,
  BodyProfileInput,
  ComfortRecord,
  DriveSession,
  SeatAdjustment,
} from "../model/bodyfit.types";

// 체형 정보는 민감한 개인정보라 기기 안(SQLite)에만 암호화해 저장하고 서버로 보내지 않는다.
const PROFILES_KEY = "bodyfit:profiles";
const ADJUSTMENTS_KEY = "bodyfit:adjustments";
const DRIVE_SESSION_KEY = "bodyfit:drive-session";
const COMFORT_KEY = "bodyfit:comfort";
// 학습에는 최근 기록만 쓰므로 운전자별로 이 개수만 남긴다.
const MAX_ADJUSTMENTS_PER_PROFILE = 50;

const profilesSchema = z.array(bodyProfileSchema);
const adjustmentsSchema = z.array(seatAdjustmentSchema);
const comfortRecordsSchema = z.array(comfortRecordSchema);

// 저장된 값도 앱 버전이 바뀌면 형식이 다를 수 있다. 검증에 실패하면 빈 목록으로 본다.
async function readList<T>(key: string, schema: z.ZodType<T[]>): Promise<T[]> {
  const raw = await getEncryptedItem(key);
  if (!raw) return [];
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

async function writeList<T>(key: string, items: readonly T[]) {
  await setEncryptedItem(key, JSON.stringify(items));
}

export function findBodyProfiles(): Promise<BodyProfile[]> {
  return readList(PROFILES_KEY, profilesSchema);
}

export async function findBodyProfile(id: string): Promise<BodyProfile | null> {
  const profiles = await findBodyProfiles();
  return profiles.find((profile) => profile.id === id) ?? null;
}

export async function createBodyProfile(
  input: BodyProfileInput,
): Promise<BodyProfile> {
  const profile: BodyProfile = {
    ...input,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    // 등록은 "동의하고 등록하기" 버튼으로만 일어난다.
    consentedAt: Date.now(),
  };
  const profiles = await findBodyProfiles();
  await writeList(PROFILES_KEY, [...profiles, profile]);
  return profile;
}

/** 프로필과 그 운전자의 자세·온도 기록, 진행 중이던 주행을 함께 지운다. */
export async function deleteBodyProfile(id: string): Promise<void> {
  const [profiles, adjustments, comfort, session] = await Promise.all([
    findBodyProfiles(),
    readList(ADJUSTMENTS_KEY, adjustmentsSchema),
    readList(COMFORT_KEY, comfortRecordsSchema),
    findDriveSession(),
  ]);
  await writeList(
    PROFILES_KEY,
    profiles.filter((profile) => profile.id !== id),
  );
  await writeList(
    ADJUSTMENTS_KEY,
    adjustments.filter((record) => record.profileId !== id),
  );
  await writeList(
    COMFORT_KEY,
    comfort.filter((record) => record.profileId !== id),
  );
  if (session?.profileId === id) await deleteDriveSession();
}

/** 진행 중인 주행. 없거나 형식이 다르면 null. */
export async function findDriveSession(): Promise<DriveSession | null> {
  const raw = await getEncryptedItem(DRIVE_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = driveSessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** 주행은 한 번에 하나다. 끝나지 않은 주행이 남아 있으면 새 주행으로 바꾼다. */
export async function createDriveSession(session: DriveSession): Promise<void> {
  await setEncryptedItem(DRIVE_SESSION_KEY, JSON.stringify(session));
}

export async function deleteDriveSession(): Promise<void> {
  await removeEncryptedItem(DRIVE_SESSION_KEY);
}

export async function findSeatAdjustments(
  profileId: string,
): Promise<SeatAdjustment[]> {
  const adjustments = await readList(ADJUSTMENTS_KEY, adjustmentsSchema);
  return adjustments.filter((record) => record.profileId === profileId);
}

export async function createSeatAdjustment(
  record: SeatAdjustment,
): Promise<void> {
  const adjustments = await readList(ADJUSTMENTS_KEY, adjustmentsSchema);
  const mine = adjustments
    .filter((item) => item.profileId === record.profileId)
    .concat(record)
    .slice(-MAX_ADJUSTMENTS_PER_PROFILE);
  const others = adjustments.filter(
    (item) => item.profileId !== record.profileId,
  );
  await writeList(ADJUSTMENTS_KEY, [...others, ...mine]);
}

export async function findComfortRecords(
  profileId: string,
): Promise<ComfortRecord[]> {
  const records = await readList(COMFORT_KEY, comfortRecordsSchema);
  return records.filter((record) => record.profileId === profileId);
}

export async function createComfortRecord(
  record: ComfortRecord,
): Promise<void> {
  const records = await readList(COMFORT_KEY, comfortRecordsSchema);
  const mine = records
    .filter((item) => item.profileId === record.profileId)
    .concat(record)
    .slice(-MAX_ADJUSTMENTS_PER_PROFILE);
  const others = records.filter((item) => item.profileId !== record.profileId);
  await writeList(COMFORT_KEY, [...others, ...mine]);
}
