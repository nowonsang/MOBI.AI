import { PleosConnect } from "@modules/pleos-connect/src/PleosConnectModule";

import type { PleosErrorCode } from "./pleos.types";

// 차량 SDK(Pleos Connect) 접근 창구. 앱 코드는 네이티브 모듈을 직접 import 하지 않고 여기를 거친다 (ESLint 로 강제).

export class PleosUnavailableError extends Error {
  readonly code: PleosErrorCode = "ERR_NOT_AUTOMOTIVE";

  constructor() {
    super("Pleos Connect 차량 환경이 아닙니다");
  }
}

/** Pleos Connect 에뮬레이터·차량에서 실행 중인지 */
export function isPleosAvailable(): boolean {
  return PleosConnect?.isAutomotive() ?? false;
}

/** 차량 환경이 아니면 PleosUnavailableError 를 던진다. */
export function pleos() {
  if (!PleosConnect || !PleosConnect.isAutomotive()) {
    throw new PleosUnavailableError();
  }
  return PleosConnect;
}

const KNOWN_CODES: readonly PleosErrorCode[] = [
  "ERR_NOT_AUTOMOTIVE",
  "ERR_NOT_PARKED",
  "ERR_SEAT_UNSUPPORTED",
  "ERR_SEAT_MOVE_FAILED",
  "ERR_PLEOS_SERVICE",
];

export function pleosErrorCode(error: unknown): PleosErrorCode | null {
  const code = (error as { code?: unknown } | null)?.code;
  return KNOWN_CODES.find((known) => known === code) ?? null;
}
