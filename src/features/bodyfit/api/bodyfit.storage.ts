import { z } from "zod";

import {
  getEncryptedItem,
  removeEncryptedItem,
  setEncryptedItem,
} from "@/shared/storage/encrypted-storage";

import type { Boarding } from "../model/bodyfit-identify";
import { appendSeatAdjustment } from "../model/bodyfit-learning";
import {
  resolveImportName,
  toImportedAdjustments,
  type PostureTransfer,
} from "../model/bodyfit-transfer";
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
// 자세 기록은 운전자·상황마다 이 개수만 남긴다 (가끔 고르는 상황의 기록이 밀려나지 않게, C-5).
const MAX_ADJUSTMENTS_PER_CONTEXT = 50;

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

const newProfileId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function createBodyProfile(
  input: BodyProfileInput,
): Promise<BodyProfile> {
  const profile: BodyProfile = {
    ...input,
    id: newProfileId(),
    createdAt: Date.now(),
    // 등록은 "동의하고 등록하기" 버튼으로만 일어난다.
    consentedAt: Date.now(),
  };
  const profiles = await findBodyProfiles();
  await writeList(PROFILES_KEY, [...profiles, profile]);
  return profile;
}

/**
 * 다른 차에서 가져온 프로필을 새 운전자로 등록한다 (A-7). transfer 는 검증을 통과한 내용이어야 한다
 * (model 의 decodeTransfer). 있던 운전자를 덮어쓰지 않는다: 이름이 같으면 번호를 붙여 새로 등록한다.
 * 가져온 학습 요약은 이 운전자의 자세 기록으로 되살려 함께 저장한다. 시트는 움직이지 않는다.
 */
export async function importBodyProfile(
  transfer: PostureTransfer,
  voiceConsent: boolean,
): Promise<BodyProfile> {
  const profiles = await findBodyProfiles();
  const now = Date.now();
  const profile: BodyProfile = {
    id: newProfileId(),
    name: resolveImportName(
      transfer.name,
      profiles.map((item) => item.name),
    ).name,
    heightCm: transfer.heightCm,
    weightKg: transfer.weightKg,
    sittingHeightCm: transfer.sittingHeightCm,
    // 동의는 옮겨 오지 않는다. 이 차에서 "동의하고 가져오기"를 누른 때와 그때 고른 음성 동의를 남긴다.
    voiceConsent,
    createdAt: now,
    consentedAt: now,
  };
  await writeList(PROFILES_KEY, [...profiles, profile]);
  try {
    const imported = toImportedAdjustments(transfer, profile, now);
    if (imported.length > 0) {
      const adjustments = await readList(ADJUSTMENTS_KEY, adjustmentsSchema);
      await writeList(ADJUSTMENTS_KEY, [...adjustments, ...imported]);
    }
  } catch (error) {
    // 보정 없이 프로필만 남으면 "가져왔어요"가 거짓이 된다. 프로필을 되돌리고 실패로 알린다.
    await writeList(PROFILES_KEY, profiles);
    throw error;
  }
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

/** 모든 운전자의 주행 시작 기록 (누가 언제 출발했는지). 탑승한 운전자를 추측하는 데 쓴다. */
export async function findBoardings(): Promise<Boarding[]> {
  const adjustments = await readList(ADJUSTMENTS_KEY, adjustmentsSchema);
  return adjustments
    .filter((record) => record.source === "drive-start")
    .map(({ profileId, at }) => ({ profileId, at }));
}

export async function createSeatAdjustment(
  record: SeatAdjustment,
): Promise<void> {
  const adjustments = await readList(ADJUSTMENTS_KEY, adjustmentsSchema);
  await writeList(
    ADJUSTMENTS_KEY,
    appendSeatAdjustment(adjustments, record, MAX_ADJUSTMENTS_PER_CONTEXT),
  );
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
