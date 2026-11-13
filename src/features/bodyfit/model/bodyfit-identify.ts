/** 누가 언제 운전을 시작했는지. 주행 시작 자세 기록(drive-start)에서 만든다. */
export type Boarding = { profileId: string; at: number };

/**
 * 추측의 근거 (화면 문구용).
 * only: 등록된 운전자가 한 명, usual-time: 이 요일·시간대에 자주 탐, after-last: 마지막 운전자 다음에 자주 탐,
 * pattern: 여러 근거를 합쳐 가장 그럴듯함
 */
export type DriverGuessReason =
  "only" | "usual-time" | "after-last" | "pattern";

export type DriverGuess = {
  profileId: string;
  /** 이 운전자일 확률 (0~1). 모델이 기록에서 배운 값이다 */
  confidence: number;
  reason: DriverGuessReason;
};

/** 이 확률 이상이면 묻지 않고 그 운전자로 넘어간다. 낮으면 "○○님이시죠?"를 묻기만 한다 */
export const AUTO_START_CONFIDENCE = 0.7;

const DAY_MS = 24 * 60 * 60 * 1000;
/** 오래된 기록일수록 덜 믿는다. 30일 지나면 절반 */
const HALF_LIFE_DAYS = 30;
/** 하루를 2시간씩 12칸으로 나눈다 */
const HOUR_BUCKETS = 12;
/** 이웃한 시간대 칸에도 이만큼 나눠 준다 (8시 59분과 9시 1분이 다른 칸이 되지 않게) */
const NEIGHBOR_SHARE = 0.5;
/** 기록이 적을 때 한쪽으로 쏠리지 않게 모든 경우에 조금씩 깔아 두는 값 (라플라스 평활) */
const SMOOTHING = 0.5;
/** 앞 운전자가 없었다(첫 기록)는 값 */
const NOBODY = "";

type Features = { bucket: number; weekend: boolean; previous: string };

const bucketOf = (at: number) => {
  const date = new Date(at);
  return Math.floor((date.getHours() + date.getMinutes() / 60) / 2);
};

const isWeekend = (at: number) => {
  const day = new Date(at).getDay();
  return day === 0 || day === 6;
};

const recencyWeight = (at: number, now: number) =>
  0.5 ** (Math.max(0, now - at) / DAY_MS / HALF_LIFE_DAYS);

/** 운전자별로 기록에서 배운 값. 기록 하나하나에 최근일수록 큰 무게를 준다 */
type DriverStats = {
  total: number;
  buckets: number[];
  weekend: number;
  previous: Map<string, number>;
};

/**
 * 탑승 기록에서 운전자별 분포를 배운다 (나이브 베이즈 학습).
 * 입력 특징: 시간대(2시간 칸), 평일/주말, 바로 앞에 탄 운전자. 모두 기록에서만 얻으며 카메라·생체정보를 쓰지 않는다.
 */
function learn(
  boardings: readonly Boarding[],
  profileIds: readonly string[],
  now: number,
): Map<string, DriverStats> {
  const stats = new Map<string, DriverStats>(
    profileIds.map((id) => [
      id,
      {
        total: 0,
        buckets: Array<number>(HOUR_BUCKETS).fill(0),
        weekend: 0,
        previous: new Map(),
      },
    ]),
  );
  const ordered = [...boardings].sort((a, b) => a.at - b.at);
  ordered.forEach((boarding, index) => {
    const driver = stats.get(boarding.profileId);
    if (!driver) return;
    const weight = recencyWeight(boarding.at, now);
    const bucket = bucketOf(boarding.at);
    const previous = ordered[index - 1]?.profileId ?? NOBODY;

    driver.total += weight;
    driver.buckets[bucket]! += weight;
    driver.buckets[(bucket + 1) % HOUR_BUCKETS]! += weight * NEIGHBOR_SHARE;
    driver.buckets[(bucket + HOUR_BUCKETS - 1) % HOUR_BUCKETS]! +=
      weight * NEIGHBOR_SHARE;
    if (isWeekend(boarding.at)) driver.weekend += weight;
    driver.previous.set(
      previous,
      (driver.previous.get(previous) ?? 0) + weight,
    );
  });
  return stats;
}

/** 운전자별 "지금 상황이 이 사람일 가능성"의 각 항 (곱하면 사후 확률에 비례한다) */
function likelihoods(
  driver: DriverStats,
  features: Features,
  driverCount: number,
) {
  const bucketTotal = driver.total * (1 + 2 * NEIGHBOR_SHARE);
  return {
    time:
      (driver.buckets[features.bucket]! + SMOOTHING) /
      (bucketTotal + SMOOTHING * HOUR_BUCKETS),
    day:
      ((features.weekend ? driver.weekend : driver.total - driver.weekend) +
        SMOOTHING) /
      (driver.total + SMOOTHING * 2),
    // 앞 운전자 후보: 운전자 수 + "없음"
    previous:
      ((driver.previous.get(features.previous) ?? 0) + SMOOTHING) /
      (driver.total + SMOOTHING * (driverCount + 1)),
  };
}

/**
 * 운전석에 앉은 사람이 누구일지 추측한다. 기기 안에서 탑승 기록으로 학습하는 확률 모델(나이브 베이즈)이다.
 * 기록이 쌓일수록 정확해지고, 결과에 확률(confidence)이 있어 확신이 낮으면 화면이 묻기만 하게 할 수 있다.
 * 틀릴 수 있으므로 화면은 "다른 사람이에요"로 바로 고치게 해야 한다. 고친 사람으로 출발하면 그 기록이 다음 학습에 들어간다.
 * 근거가 없으면(기록이 없고 운전자가 여럿) null.
 */
export function guessDriver({
  profileIds,
  boardings,
  now,
}: {
  profileIds: readonly string[];
  boardings: readonly Boarding[];
  now: number;
}): DriverGuess | null {
  if (profileIds.length === 0) return null;
  if (profileIds.length === 1)
    return { profileId: profileIds[0]!, confidence: 1, reason: "only" };

  const known = new Set(profileIds);
  // 지운 운전자의 기록, 미래 시각(시계가 틀린 기록)은 쓰지 않는다.
  const usable = boardings.filter(
    (boarding) => known.has(boarding.profileId) && boarding.at <= now,
  );
  if (usable.length === 0) return null;

  const stats = learn(usable, profileIds, now);
  const last = usable.reduce((a, b) => (b.at > a.at ? b : a));
  const features: Features = {
    bucket: bucketOf(now),
    weekend: isWeekend(now),
    previous: last.profileId,
  };
  const grandTotal = [...stats.values()].reduce((sum, d) => sum + d.total, 0);

  const scored = profileIds.map((id) => {
    const driver = stats.get(id)!;
    const prior =
      (driver.total + SMOOTHING) / (grandTotal + SMOOTHING * profileIds.length);
    const terms = likelihoods(driver, features, profileIds.length);
    return {
      id,
      terms,
      score: prior * terms.time * terms.day * terms.previous,
    };
  });
  const sum = scored.reduce((total, entry) => total + entry.score, 0);
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));

  return {
    profileId: best.id,
    confidence: best.score / sum,
    reason: reasonFor(best.id, scored),
  };
}

/** 1등이 다른 운전자보다 가장 크게 앞선 항을 근거로 말한다 */
function reasonFor(
  bestId: string,
  scored: readonly {
    id: string;
    terms: ReturnType<typeof likelihoods>;
  }[],
): DriverGuessReason {
  const best = scored.find((entry) => entry.id === bestId)!;
  const others = scored.filter((entry) => entry.id !== bestId);
  const lead = (key: "time" | "day" | "previous") =>
    best.terms[key] / Math.max(...others.map((entry) => entry.terms[key]));
  const timeLead = lead("time") * lead("day");
  const previousLead = lead("previous");
  if (timeLead >= 1.5 && timeLead >= previousLead) return "usual-time";
  if (previousLead >= 1.5) return "after-last";
  return "pattern";
}
