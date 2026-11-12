import type { DriveContext } from "./bodyfit.types";

/** 고를 수 있는 운전 상황 (화면에 보이는 순서) */
export const DRIVE_CONTEXTS = [
  "usual",
  "commute",
  "long",
  "city",
] as const satisfies readonly DriveContext[];

/** 운전자가 고르지 않았을 때의 상황. 상황이 생기기 전에 저장된 기록도 이 상황으로 읽는다 */
export const DEFAULT_DRIVE_CONTEXT: DriveContext = "usual";

export const DRIVE_CONTEXT_LABEL: Record<DriveContext, string> = {
  usual: "평소",
  commute: "출퇴근",
  long: "장거리",
  city: "시내",
};

/** 화면 주소로 넘어온 값처럼 믿을 수 없는 값을 운전 상황으로 읽는다. 아는 상황이 아니면 null */
export function parseDriveContext(value: unknown): DriveContext | null {
  return DRIVE_CONTEXTS.find((context) => context === value) ?? null;
}
