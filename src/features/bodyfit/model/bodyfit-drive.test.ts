import type { Gear } from "@/shared/pleos/pleos.types";

import {
  DEMO_LONG_DRIVE_MS,
  LONG_DRIVE_MS,
  STALE_DRIVE_MS,
  comfortPromptFor,
  isLongDrive,
  parseMeasurement,
  trackGear,
  type DriveEvent,
} from "./bodyfit-drive";

/** 기어가 순서대로 바뀔 때 생기는 주행 이벤트 */
function eventsOf(gears: readonly Gear[]): (DriveEvent | null)[] {
  let previous: Gear | null = null;
  return gears.map((gear) => {
    const tracked = trackGear(previous, gear);
    previous = tracked.gear;
    return tracked.event;
  });
}

describe("isLongDrive", () => {
  it("출발 시각을 모르면 장거리 주행이 아니다", () => {
    expect(isLongDrive(null, LONG_DRIVE_MS * 2)).toBe(false);
  });

  it("60분을 채워야 장거리 주행이다", () => {
    expect(isLongDrive(1_000, 1_000 + LONG_DRIVE_MS - 1)).toBe(false);
    expect(isLongDrive(1_000, 1_000 + LONG_DRIVE_MS)).toBe(true);
  });
});

describe("trackGear", () => {
  it("처음 알게 된 기어가 P 면 주차로 본다 (앱이 꺼진 사이 끝난 주행을 닫는다)", () => {
    expect(trackGear(null, "park")).toEqual({ gear: "park", event: "parked" });
  });

  it("처음 알게 된 기어가 P 가 아니면 기준으로만 삼는다", () => {
    expect(trackGear(null, "drive")).toEqual({ gear: "drive", event: null });
    expect(trackGear(null, "reverse")).toEqual({
      gear: "reverse",
      event: null,
    });
  });

  it("주차(P)에서 벗어나면 출발이다", () => {
    expect(eventsOf(["park", "drive"])).toEqual(["parked", "started"]);
    // 후진으로 주차 칸을 빠져나가는 것도 출발이다.
    expect(eventsOf(["park", "reverse"])).toEqual(["parked", "started"]);
  });

  it("주차(P)로 돌아오면 주차다", () => {
    expect(eventsOf(["drive", "park"])).toEqual([null, "parked"]);
  });

  it("주행 중 앱이 다시 켜진 뒤 주차해도 주차를 잡는다", () => {
    // 차량이 앱을 종료했다가 다시 켠 경우: 출발은 보지 못했고 D 가 처음 알게 된 기어다.
    expect(eventsOf(["drive", "neutral", "park"])).toEqual([
      null,
      null,
      "parked",
    ]);
  });

  it("달리는 중의 기어 변화와 같은 기어 반복은 이벤트가 아니다", () => {
    expect(
      eventsOf(["park", "park", "drive", "neutral", "drive", "drive"]),
    ).toEqual(["parked", null, "started", null, null, null]);
  });

  it("기어를 알 수 없는 순간은 건너뛴다", () => {
    // 주차 중 값을 잠깐 놓쳐도 출발로 기록하지 않는다.
    expect(eventsOf(["park", "unknown", "park"])).toEqual([
      "parked",
      null,
      null,
    ]);
    // 놓친 뒤에 온 실제 변화는 그대로 잡는다.
    expect(eventsOf(["park", "unknown", "drive"])).toEqual([
      "parked",
      null,
      "started",
    ]);
    expect(eventsOf(["drive", "unknown", "park"])).toEqual([
      null,
      null,
      "parked",
    ]);
  });

  it("기어를 모르는 채로 시작하면 처음 알게 된 기어부터 따진다", () => {
    expect(eventsOf(["unknown", "park", "drive"])).toEqual([
      null,
      "parked",
      "started",
    ]);
  });
});

describe("comfortPromptFor", () => {
  const longDrive = {
    startedAt: 0,
    now: LONG_DRIVE_MS,
    parked: true,
    voice: false,
  };

  it("오래 달린 뒤 주차하면 화면으로 묻는다", () => {
    expect(comfortPromptFor(longDrive)).toBe("screen");
  });

  it("주차 전에는 화면으로 묻지 않는다", () => {
    expect(comfortPromptFor({ ...longDrive, parked: false })).toBeNull();
  });

  it("시연 빌드 기준(1분)을 넘기면 60분이 안 돼도 묻는다", () => {
    const demo = { ...longDrive, longDriveMs: DEMO_LONG_DRIVE_MS };
    expect(comfortPromptFor({ ...demo, now: DEMO_LONG_DRIVE_MS })).toBe(
      "screen",
    );
    expect(
      comfortPromptFor({ ...demo, now: DEMO_LONG_DRIVE_MS - 1 }),
    ).toBeNull();
  });

  it("짧게 달렸거나 출발 시각을 모르면 묻지 않는다", () => {
    expect(
      comfortPromptFor({ ...longDrive, now: LONG_DRIVE_MS - 1 }),
    ).toBeNull();
    expect(comfortPromptFor({ ...longDrive, startedAt: null })).toBeNull();
  });

  it("출발한 지 너무 오래된 기록으로는 묻지 않는다", () => {
    expect(comfortPromptFor({ ...longDrive, now: STALE_DRIVE_MS })).toBe(
      "screen",
    );
    expect(
      comfortPromptFor({ ...longDrive, now: STALE_DRIVE_MS + 1 }),
    ).toBeNull();
    expect(
      comfortPromptFor({ ...longDrive, now: STALE_DRIVE_MS + 1, voice: true }),
    ).toBeNull();
  });

  it("시계가 뒤로 가서 출발 시각이 미래여도 묻지 않는다", () => {
    expect(
      comfortPromptFor({ ...longDrive, startedAt: LONG_DRIVE_MS * 3 }),
    ).toBeNull();
  });

  it("음성에 동의한 운전자에게는 주차 전이어도 음성으로 묻는다", () => {
    expect(comfortPromptFor({ ...longDrive, voice: true })).toBe("voice");
    expect(comfortPromptFor({ ...longDrive, voice: true, parked: false })).toBe(
      "voice",
    );
  });
});

describe("parseMeasurement", () => {
  it("단위와 공백이 섞여도 숫자만 읽는다", () => {
    expect(parseMeasurement("175cm")).toBe(175);
    expect(parseMeasurement(" 175.5 ")).toBe(175.5);
    expect(parseMeasurement("68,5kg")).toBe(68.5);
  });

  it("숫자가 없으면 NaN 이다", () => {
    expect(parseMeasurement("")).toBeNaN();
    expect(parseMeasurement("모름")).toBeNaN();
  });
});
