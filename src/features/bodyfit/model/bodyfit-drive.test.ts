import type { Gear } from "@/shared/pleos/pleos.types";

import {
  LONG_DRIVE_MS,
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
  it("처음 알게 된 기어는 기준으로만 삼는다", () => {
    expect(trackGear(null, "park")).toEqual({ gear: "park", event: null });
    expect(trackGear(null, "drive")).toEqual({ gear: "drive", event: null });
  });

  it("주차(P)에서 벗어나면 출발이다", () => {
    expect(eventsOf(["park", "drive"])).toEqual([null, "started"]);
    // 후진으로 주차 칸을 빠져나가는 것도 출발이다.
    expect(eventsOf(["park", "reverse"])).toEqual([null, "started"]);
  });

  it("주차(P)로 돌아오면 주차다", () => {
    expect(eventsOf(["drive", "park"])).toEqual([null, "parked"]);
  });

  it("달리는 중의 기어 변화와 같은 기어 반복은 이벤트가 아니다", () => {
    expect(eventsOf(["park", "drive", "neutral", "drive", "drive"])).toEqual([
      null,
      "started",
      null,
      null,
      null,
    ]);
  });

  it("기어를 알 수 없는 순간은 건너뛴다", () => {
    // 주차 중 값을 잠깐 놓쳐도 출발로 기록하지 않는다.
    expect(eventsOf(["park", "unknown", "park"])).toEqual([null, null, null]);
    // 놓친 뒤에 온 실제 변화는 그대로 잡는다.
    expect(eventsOf(["park", "unknown", "drive"])).toEqual([
      null,
      null,
      "started",
    ]);
    expect(eventsOf(["drive", "unknown", "park"])).toEqual([
      null,
      null,
      "parked",
    ]);
  });

  it("기어를 모르는 채로 시작하면 처음 알게 된 기어가 기준이다", () => {
    expect(eventsOf(["unknown", "park", "drive"])).toEqual([
      null,
      null,
      "started",
    ]);
  });
});

describe("comfortPromptFor", () => {
  const longDrive = {
    startedAt: 0,
    now: LONG_DRIVE_MS,
    parked: true,
    alreadyAsked: false,
    voice: false,
  };

  it("오래 달린 뒤 주차하면 화면으로 묻는다", () => {
    expect(comfortPromptFor(longDrive)).toBe("screen");
  });

  it("주차 전에는 화면으로 묻지 않는다", () => {
    expect(comfortPromptFor({ ...longDrive, parked: false })).toBeNull();
  });

  it("짧게 달렸거나 출발 시각을 모르면 묻지 않는다", () => {
    expect(
      comfortPromptFor({ ...longDrive, now: LONG_DRIVE_MS - 1 }),
    ).toBeNull();
    expect(comfortPromptFor({ ...longDrive, startedAt: null })).toBeNull();
  });

  it("한 번의 주행에 한 번만 묻는다", () => {
    expect(comfortPromptFor({ ...longDrive, alreadyAsked: true })).toBeNull();
    expect(
      comfortPromptFor({ ...longDrive, alreadyAsked: true, voice: true }),
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
