import {
  POSTURE_SUSTAIN_MIN,
  comparePostureDrives,
  latestPostureDrive,
  samplePostureDrives,
  suggestForPosture,
  suggestRestMin,
  summarizePostureDrive,
  type PostureDrive,
  type PostureSample,
} from "./bodyfit-posture";
import { postureDriveSchema } from "./bodyfit.schema";

const still = (minute: number): PostureSample => ({
  minute,
  headForwardCm: 0,
  shoulderDropCm: 0,
  backLeanDeg: 0,
});

const forward = (minute: number): PostureSample => ({
  minute,
  headForwardCm: 4,
  shoulderDropCm: 1,
  backLeanDeg: 6,
});

const drive = (
  samples: PostureSample[],
  overrides: Partial<PostureDrive> = {},
): PostureDrive => ({
  profileId: "p1",
  startedAt: 1_000,
  context: "long",
  durationMin: 100,
  samples,
  sample: false,
  ...overrides,
});

describe("주행 자세 리포트", () => {
  it("끝까지 출발 자세였으면 쏠림이 없다", () => {
    const report = summarizePostureDrive(
      drive([still(0), still(30), still(60), still(100)]),
    );
    expect(report).toEqual({
      durationMin: 100,
      driftStartMin: null,
      heldMin: 100,
      driftMin: 0,
      change: { headForwardCm: 0, shoulderDropCm: 0, backLeanDeg: 0 },
    });
  });

  it("쏠리기 시작한 때부터 도착까지를 쏠림으로 보고, 그 뒤의 평균 변화를 낸다", () => {
    const report = summarizePostureDrive(
      drive([still(0), still(40), forward(50), forward(70), forward(100)]),
    );
    expect(report.driftStartMin).toBe(50);
    expect(report.heldMin).toBe(50);
    expect(report.driftMin).toBe(50);
    expect(report.change).toEqual({
      headForwardCm: 4,
      shoulderDropCm: 1,
      backLeanDeg: 6,
    });
  });

  it("잠깐 숙였다가 바로 돌아온 것은 쏠림으로 보지 않는다", () => {
    const report = summarizePostureDrive(
      drive([
        still(0),
        forward(20),
        still(20 + POSTURE_SUSTAIN_MIN - 1),
        still(100),
      ]),
    );
    expect(report.driftStartMin).toBeNull();
  });

  it("오래 쏠렸다가 돌아왔으면 처음 쏠린 때를 시작으로 본다", () => {
    const report = summarizePostureDrive(
      drive([still(0), forward(30), forward(45), still(60), still(100)]),
    );
    expect(report.driftStartMin).toBe(30);
    expect(report.heldMin).toBe(30);
  });

  it("도착 직전에 잠깐 쏠린 것은 쏠림으로 보지 않는다", () => {
    const report = summarizePostureDrive(
      drive([still(0), still(90), forward(100 - POSTURE_SUSTAIN_MIN + 1)]),
    );
    expect(report.driftStartMin).toBeNull();
  });

  it("머리나 등 가운데 하나만 기준을 넘어도 쏠림이다", () => {
    const headOnly = { ...still(50), headForwardCm: 3 };
    const backOnly = { ...still(50), backLeanDeg: 4 };
    expect(
      summarizePostureDrive(
        drive([still(0), headOnly, { ...headOnly, minute: 100 }]),
      ).driftStartMin,
    ).toBe(50);
    expect(
      summarizePostureDrive(
        drive([still(0), backOnly, { ...backOnly, minute: 100 }]),
      ).driftStartMin,
    ).toBe(50);
  });

  it("순서가 섞인 값과 주행 시간 밖의 값도 견딘다", () => {
    const report = summarizePostureDrive(
      drive([forward(100), still(0), forward(60), forward(500), still(-5)]),
    );
    expect(report.driftStartMin).toBe(60);
    expect(report.driftMin).toBe(40);
  });

  it("기록이 하나도 없으면 쏠림이 없는 것으로 본다", () => {
    expect(summarizePostureDrive(drive([])).driftStartMin).toBeNull();
  });
});

describe("자세 리포트 → 조절 제안", () => {
  it("앞으로 쏠렸으면 등받이를 세우자고 제안한다", () => {
    const report = summarizePostureDrive(
      drive([still(0), forward(50), forward(100)]),
    );
    expect(suggestForPosture(report)).toEqual({
      axis: "backrest",
      direction: "increase",
      amount: "medium",
    });
  });

  it("쏠리지 않았으면 제안하지 않는다", () => {
    expect(
      suggestForPosture(summarizePostureDrive(drive([still(0), still(100)]))),
    ).toBeNull();
  });
});

describe("지난 주행과 비교", () => {
  const before = drive([still(0), forward(50), forward(112)], {
    startedAt: 1_000,
    durationMin: 112,
  });
  const latest = drive([still(0), forward(85), forward(125)], {
    startedAt: 2_000,
    durationMin: 125,
  });

  it("같은 상황의 최근 두 주행을 견주고, 긴 쪽 시간을 눈금으로 쓴다", () => {
    const comparison = comparePostureDrives([latest, before], "long");
    expect(comparison?.previous.heldMin).toBe(50);
    expect(comparison?.current.heldMin).toBe(85);
    expect(comparison?.heldDeltaMin).toBe(35);
    expect(comparison?.scaleMin).toBe(125);
  });

  it("다른 상황의 주행은 섞지 않는다", () => {
    const city = drive([still(0), still(20)], {
      startedAt: 3_000,
      context: "city",
      durationMin: 20,
    });
    expect(comparePostureDrives([before, city], "long")).toBeNull();
    expect(
      comparePostureDrives([before, latest, city], "long")?.current.durationMin,
    ).toBe(125);
  });

  it("가장 최근 주행을 고른다", () => {
    expect(latestPostureDrive([before, latest])?.startedAt).toBe(2_000);
    expect(latestPostureDrive([before, latest], "city")).toBeNull();
    expect(latestPostureDrive([])).toBeNull();
  });
});

describe("쉬어 가기 좋은 때", () => {
  const reportAt = (start: number) =>
    summarizePostureDrive(drive([still(0), forward(start), forward(100)]));

  it("쏠리기 시작한 때보다 앞선 10분 단위를 권한다", () => {
    expect(suggestRestMin(reportAt(85))).toBe(80);
    expect(suggestRestMin(reportAt(50))).toBe(40);
    expect(suggestRestMin(reportAt(11))).toBe(10);
  });

  it("쏠리지 않았거나 너무 일찍 쏠렸으면 권하지 않는다", () => {
    expect(suggestRestMin(summarizePostureDrive(drive([still(0)])))).toBeNull();
    expect(suggestRestMin(reportAt(10))).toBeNull();
  });
});

describe("예시 기록", () => {
  const drives = samplePostureDrives("p1", 1_800_000_000_000);

  it("스키마를 통과하고 예시로 표시되어 있다", () => {
    for (const item of drives) {
      expect(postureDriveSchema.safeParse(item).success).toBe(true);
      expect(item.sample).toBe(true);
    }
  });

  it("지난 장거리는 50분, 이번 장거리는 85분 동안 유지한 이야기다", () => {
    const comparison = comparePostureDrives(drives, "long");
    expect(comparison?.previous.heldMin).toBe(50);
    expect(comparison?.current.heldMin).toBe(85);
    expect(comparison?.previous.change).toEqual({
      headForwardCm: 4,
      shoulderDropCm: 0,
      backLeanDeg: 6,
    });
  });
});

describe("자세 기록 스키마", () => {
  it("사람이 앉은 채로 움직일 수 없는 값은 받지 않는다", () => {
    const base = drive([still(0)]);
    expect(
      postureDriveSchema.safeParse({
        ...base,
        samples: [{ ...still(0), headForwardCm: 80 }],
      }).success,
    ).toBe(false);
    expect(
      postureDriveSchema.safeParse({ ...base, durationMin: 0 }).success,
    ).toBe(false);
  });

  it("예시 표시가 없는 기록은 실제 기록으로 읽는다", () => {
    const { sample: _sample, ...rest } = drive([still(0)]);
    expect(postureDriveSchema.parse(rest).sample).toBe(false);
  });
});
