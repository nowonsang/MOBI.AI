import type { Gear } from "@/shared/pleos/pleos.types";

// 이 시간 이상 주행한 뒤 주차(P)하거나 목적지에 도착하면 착좌감을 묻는다.
export const LONG_DRIVE_MS = 60 * 60 * 1000;

export const COMFORT_QUESTION =
  "오늘 운전 자세는 편하셨나요? 불편한 곳이 있으면 말씀해 주세요";

/** 화면으로 묻는 주행 후 질문 (D-1). 주차(P) 중에만 띄운다. */
export const COMFORT_SCREEN_QUESTION = "오늘 운전 자세는 편하셨나요?";

export function isLongDrive(startedAt: number | null, now: number): boolean {
  return startedAt !== null && now - startedAt >= LONG_DRIVE_MS;
}

/** started: 주차(P)에서 벗어남 (출발 자세 기록 C-3), parked: 주차(P)로 돌아옴 (주행 후 질문 D-1) */
export type DriveEvent = "started" | "parked";

/**
 * 기어 변화를 주행 흐름으로 바꾼다. 돌려준 gear 를 다음 호출의 previous 로 넘긴다.
 * 처음 알게 된 기어는 기준으로만 삼고, "unknown" 은 정보가 없는 것이라 건너뛴다
 * (센서가 잠깐 값을 놓쳐도 출발·주차로 잘못 기록하지 않는다).
 */
export function trackGear(
  previous: Gear | null,
  gear: Gear,
): { gear: Gear | null; event: DriveEvent | null } {
  if (gear === "unknown") return { gear: previous, event: null };
  if (previous === null || previous === gear) return { gear, event: null };
  if (previous === "park") return { gear, event: "started" };
  if (gear === "park") return { gear, event: "parked" };
  return { gear, event: null };
}

/** screen: 화면 질문 (D-1 주 경로), voice: 음성 질문 (추후 고도화) */
export type ComfortPrompt = "screen" | "voice";

/**
 * 주행 후 질문을 지금 할지, 어떤 방식으로 할지 정한다. 한 번의 주행에 한 번만 묻는다.
 * 화면 질문은 주차(P) 중에만 띄운다 (S-5). 달리는 중에 도착했다면 주차할 때 다시 판단한다.
 */
export function comfortPromptFor({
  startedAt,
  now,
  parked,
  alreadyAsked,
  voice,
}: {
  startedAt: number | null;
  now: number;
  parked: boolean;
  alreadyAsked: boolean;
  /** 음성 기능을 쓸 수 있고 운전자가 동의했는지 */
  voice: boolean;
}): ComfortPrompt | null {
  if (alreadyAsked || !isLongDrive(startedAt, now)) return null;
  if (voice) return "voice";
  return parked ? "screen" : null;
}

/** "175cm", " 175.5 " 처럼 단위·공백이 섞여도 숫자만 읽는다. 읽을 수 없으면 NaN. */
export function parseMeasurement(text: string): number {
  const match = text.replace(/,/g, ".").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}
