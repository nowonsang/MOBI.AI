import type { DriveContext, SeatNudge } from "./bodyfit.types";

/*
 * 주행 중 자세 관찰: 출발할 때의 자세를 기준으로, 주행 중 얼마나 달라졌는지를 정리한다.
 * 값(PostureSample)은 카메라 분석이 넘겨준다. 이 파일은 그 값을 화면이 읽기 쉬운 모양으로 바꾸기만 한다.
 */

/** 출발 자세와 비교한 한 시점의 차이 */
export type PostureSample = {
  /** 출발한 뒤 지난 시간(분) */
  minute: number;
  /** 머리가 출발 때보다 앞으로 나온 거리(cm). 뒤로 갔으면 음수 */
  headForwardCm: number;
  /** 어깨가 출발 때보다 내려간 거리(cm). 올라갔으면 음수 */
  shoulderDropCm: number;
  /** 등이 출발 때보다 앞으로 숙여진 각도(도). 더 기댔으면 음수 */
  backLeanDeg: number;
};

/** 한 번의 주행에서 관찰한 자세 기록 */
export type PostureDrive = {
  profileId: string;
  startedAt: number;
  context: DriveContext;
  durationMin: number;
  samples: PostureSample[];
  /** 실제 주행이 아니라 화면을 보여 주기 위한 예시 기록 */
  sample: boolean;
};

// 이 값 이상 달라지면 "앞으로 쏠렸다"고 본다.
// 근거 자료가 있는 값이 아니라 화면을 만들기 위한 임시 기준이다. 카메라 분석의 오차를 보고 다시 정한다.
export const POSTURE_DRIFT = { headForwardCm: 3, backLeanDeg: 4 } as const;

// 잠깐 몸을 숙인 것(컵 집기 등)은 빼려고, 이만큼(분) 이어져야 쏠림으로 본다.
export const POSTURE_SUSTAIN_MIN = 5;

export type PostureChange = Pick<
  PostureSample,
  "headForwardCm" | "shoulderDropCm" | "backLeanDeg"
>;

export type PostureReport = {
  durationMin: number;
  /** 쏠리기 시작한 때(분). 끝까지 출발 자세를 유지했으면 null */
  driftStartMin: number | null;
  /** 출발 자세를 유지한 시간(분) */
  heldMin: number;
  /** 쏠리기 시작한 뒤부터 도착까지(분). 중간에 다시 바로 앉은 시간도 여기에 든다 */
  driftMin: number;
  /** 쏠리기 시작한 뒤의 평균 변화 (정수로 반올림). 쏠리지 않았으면 모두 0 */
  change: PostureChange;
};

const isDrifted = (sample: PostureSample) =>
  sample.headForwardCm >= POSTURE_DRIFT.headForwardCm ||
  sample.backLeanDeg >= POSTURE_DRIFT.backLeanDeg;

const mean = (values: readonly number[]) =>
  values.length === 0
    ? 0
    : // -0 이 화면·비교에 섞이지 않게 0 을 더한다
      Math.round(
        values.reduce((sum, value) => sum + value, 0) / values.length,
      ) + 0;

/**
 * 한 주행의 자세 기록 → 리포트.
 * "쏠리기 시작한 때"는 쏠림이 POSTURE_SUSTAIN_MIN 분 넘게 이어진 첫 구간의 시작이다.
 */
export function summarizePostureDrive(drive: PostureDrive): PostureReport {
  const samples = drive.samples
    .filter(
      (sample) => sample.minute >= 0 && sample.minute <= drive.durationMin,
    )
    .sort((a, b) => a.minute - b.minute);

  let driftStartMin: number | null = null;
  let runStart: number | null = null;
  for (const sample of samples) {
    if (isDrifted(sample)) {
      runStart ??= sample.minute;
      continue;
    }
    if (runStart !== null && sample.minute - runStart >= POSTURE_SUSTAIN_MIN) {
      driftStartMin = runStart;
      break;
    }
    runStart = null;
  }
  // 도착할 때까지 쏠린 채였던 구간
  if (
    driftStartMin === null &&
    runStart !== null &&
    drive.durationMin - runStart >= POSTURE_SUSTAIN_MIN
  ) {
    driftStartMin = runStart;
  }

  if (driftStartMin === null) {
    return {
      durationMin: drive.durationMin,
      driftStartMin: null,
      heldMin: drive.durationMin,
      driftMin: 0,
      change: { headForwardCm: 0, shoulderDropCm: 0, backLeanDeg: 0 },
    };
  }

  const start = driftStartMin;
  const after = samples.filter((sample) => sample.minute >= start);
  return {
    durationMin: drive.durationMin,
    driftStartMin: start,
    heldMin: start,
    driftMin: drive.durationMin - start,
    change: {
      headForwardCm: mean(after.map((sample) => sample.headForwardCm)),
      shoulderDropCm: mean(after.map((sample) => sample.shoulderDropCm)),
      backLeanDeg: mean(after.map((sample) => sample.backLeanDeg)),
    },
  };
}

/**
 * 리포트 → 다음 주행을 위한 조절 제안. 쏠리지 않았으면 제안하지 않는다.
 * "앞으로 쏠리면 등받이를 조금 세운다"는 기획 시나리오의 규칙이다. 맞는 제안이었는지는
 * 다음 주행에서 출발 자세를 더 오래 유지했는지로 확인한다 (comparePostureDrives).
 * 터치 피드백과 같은 양(medium)을 써서 다음 추천이 눈에 보이게 달라진다.
 */
export function suggestForPosture(report: PostureReport): SeatNudge | null {
  if (report.driftStartMin === null) return null;
  return { axis: "backrest", direction: "increase", amount: "medium" };
}

/**
 * 다음 주행에서 쉬어 가기 좋은 때(분): 쏠리기 시작한 때보다 앞선 10분 단위.
 * 쏠리지 않았거나 10분도 안 돼 쏠렸으면 권하지 않는다 (null).
 */
export function suggestRestMin(report: PostureReport): number | null {
  if (report.driftStartMin === null) return null;
  const rest = Math.floor((report.driftStartMin - 1) / 10) * 10;
  return rest >= 10 ? rest : null;
}

/** 그 상황의 가장 최근 주행 기록. 없으면 null */
export function latestPostureDrive(
  drives: readonly PostureDrive[],
  context?: DriveContext,
): PostureDrive | null {
  return (
    drives
      .filter((drive) => context === undefined || drive.context === context)
      .sort((a, b) => b.startedAt - a.startedAt)[0] ?? null
  );
}

export type PostureComparison = {
  context: DriveContext;
  previous: PostureReport;
  current: PostureReport;
  /** 이번에 출발 자세를 더 유지한 시간(분). 음수면 덜 유지했다 */
  heldDeltaMin: number;
  /** 두 주행을 같은 시간 눈금으로 그리기 위한 긴 쪽 주행 시간(분) */
  scaleMin: number;
};

/** 같은 상황의 최근 두 주행을 견준다. 두 번이 안 되면 null */
export function comparePostureDrives(
  drives: readonly PostureDrive[],
  context: DriveContext,
): PostureComparison | null {
  const [latest, before] = drives
    .filter((drive) => drive.context === context)
    .sort((a, b) => b.startedAt - a.startedAt);
  if (!latest || !before) return null;
  const previous = summarizePostureDrive(before);
  const current = summarizePostureDrive(latest);
  return {
    context,
    previous,
    current,
    heldDeltaMin: current.heldMin - previous.heldMin,
    scaleMin: Math.max(previous.durationMin, current.durationMin),
  };
}

/** 화면을 보여 주기 위한 예시 기록 두 건 (지난 장거리, 이번 장거리). 실제 관찰값이 아니다. */
export function samplePostureDrives(
  profileId: string,
  now: number,
): PostureDrive[] {
  const MINUTE = 60_000;
  const DAY = 24 * 60 * MINUTE;
  // 5분 간격. driftFrom 분부터 머리·등이 앞으로 간 것으로 둔다.
  const samples = (
    durationMin: number,
    driftFrom: number,
    drift: PostureChange,
  ): PostureSample[] =>
    Array.from({ length: Math.floor(durationMin / 5) + 1 }, (_, index) => {
      const minute = index * 5;
      return minute >= driftFrom
        ? { minute, ...drift }
        : { minute, headForwardCm: 0, shoulderDropCm: 0, backLeanDeg: 0 };
    });
  return [
    {
      profileId,
      startedAt: now - 7 * DAY,
      context: "long",
      durationMin: 112,
      samples: samples(112, 50, {
        headForwardCm: 4,
        shoulderDropCm: 0,
        backLeanDeg: 6,
      }),
      sample: true,
    },
    {
      profileId,
      startedAt: now - 125 * MINUTE,
      context: "long",
      durationMin: 125,
      samples: samples(125, 85, {
        headForwardCm: 3,
        shoulderDropCm: 0,
        backLeanDeg: 4,
      }),
      sample: true,
    },
  ];
}
