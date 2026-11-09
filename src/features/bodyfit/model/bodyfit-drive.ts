// 이 시간 이상 주행한 뒤 주차(P)하거나 목적지에 도착하면 착좌감을 묻는다.
export const LONG_DRIVE_MS = 60 * 60 * 1000;

export const COMFORT_QUESTION =
  "오늘 운전 자세는 편하셨나요? 불편한 곳이 있으면 말씀해 주세요";

export function isLongDrive(startedAt: number | null, now: number): boolean {
  return startedAt !== null && now - startedAt >= LONG_DRIVE_MS;
}

/** "175cm", " 175.5 " 처럼 단위·공백이 섞여도 숫자만 읽는다. 읽을 수 없으면 NaN. */
export function parseMeasurement(text: string): number {
  const match = text.replace(/,/g, ".").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}
