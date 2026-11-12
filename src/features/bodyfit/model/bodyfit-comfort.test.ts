import {
  comfortChanges,
  hasAmbient,
  recommendComfort,
  toComfortRecord,
  toComfortSettings,
} from "./bodyfit-comfort";
import { comfortRecordSchema } from "./bodyfit.schema";
import type { ComfortRecord } from "./bodyfit.types";

const record = (
  at: number,
  cabinTemp: number | null,
  settings: ComfortRecord["settings"],
): ComfortRecord => ({ profileId: "a", at, cabinTemp, settings });

describe("toComfortSettings", () => {
  it("차량이 알려 준 항목의 값만 꺼낸다", () => {
    expect(
      toComfortSettings({
        seatHeat: { value: 2, min: -3, max: 3 },
        cabinTarget: { value: 22.5, min: 16, max: 32 },
        cabinCurrent: 8,
      }),
    ).toEqual({ seatHeat: 2, cabinTarget: 22.5 });
  });

  it("통풍은 열선과 따로, 풍량과 바람 방향도 함께 꺼낸다", () => {
    expect(
      toComfortSettings({
        seatHeat: { value: 0, min: 0, max: 3 },
        seatVent: { value: 2, min: 0, max: 3 },
        fanSpeed: { value: 4, min: 1, max: 8 },
        fanDirection: { value: "faceFloor", options: ["face", "faceFloor"] },
        fanMode: "manual",
      }),
    ).toEqual({
      seatHeat: 0,
      seatVent: 2,
      fanSpeed: 4,
      fanDirection: "faceFloor",
    });
  });

  it("자동 공조이거나 공조가 꺼져 있으면 풍량과 바람 방향은 취향으로 남기지 않는다", () => {
    const fan = {
      seatVent: { value: 1, min: 0, max: 3 },
      fanSpeed: { value: 6, min: 1, max: 8 },
      fanDirection: { value: "face" as const, options: ["face" as const] },
    };
    expect(toComfortSettings({ ...fan, fanMode: "auto" })).toEqual({
      seatVent: 1,
    });
    expect(toComfortSettings({ ...fan, fanMode: "off" })).toEqual({
      seatVent: 1,
    });
  });

  it("차량 범위 밖 풍량(꺼짐을 0 으로 알려 주는 차)은 남기지 않는다", () => {
    expect(
      toComfortSettings({ fanSpeed: { value: 0, min: 1, max: 8 } }),
    ).toEqual({});
    expect(
      toComfortSettings({ fanSpeed: { value: 0, min: 0, max: 8 } }),
    ).toEqual({ fanSpeed: 0 });
  });
});

describe("toComfortRecord", () => {
  it("한여름 차 안처럼 뜨거운 실내 온도도 기록하고, 저장 형식 검증을 통과한다", () => {
    const record = toComfortRecord("a", 1, {
      seatHeat: { value: -2, min: -3, max: 3 },
      cabinCurrent: 72,
    });
    expect(record).toEqual({
      profileId: "a",
      at: 1,
      cabinTemp: 72,
      settings: { seatHeat: -2 },
    });
    expect(comfortRecordSchema.safeParse(record).success).toBe(true);
  });

  it("범위를 벗어난 값은 그 항목만 빼서 저장한 목록이 통째로 버려지지 않게 한다", () => {
    const record = toComfortRecord("a", 1, {
      seatHeat: { value: 1.5, min: 0, max: 3 },
      steeringHeat: { value: 1, min: 0, max: 1 },
      // AAOS 는 LO/HI 를 범위 밖 특수 값으로 주기도 한다
      cabinTarget: { value: 99, min: 16, max: 32 },
      cabinCurrent: Number.NaN,
    });
    expect(record).toEqual({
      profileId: "a",
      at: 1,
      cabinTemp: null,
      settings: { steeringHeat: 1 },
    });
    expect(comfortRecordSchema.safeParse(record).success).toBe(true);
  });

  it("기록할 항목이 없으면 남기지 않는다", () => {
    expect(toComfortRecord("a", 1, { cabinCurrent: 10 })).toBeNull();
  });

  it("통풍·풍량·바람 방향이 든 기록도 저장 형식 검증을 통과한다", () => {
    const record = toComfortRecord("a", 1, {
      seatVent: { value: 3, min: 0, max: 3 },
      fanSpeed: { value: 8, min: 1, max: 8 },
      fanDirection: { value: "floorDefrost", options: ["floorDefrost"] },
      cabinCurrent: 31,
    });
    expect(record?.settings).toEqual({
      seatVent: 3,
      fanSpeed: 8,
      fanDirection: "floorDefrost",
    });
    expect(comfortRecordSchema.safeParse(record).success).toBe(true);
  });
});

describe("comfortRecordSchema", () => {
  it("통풍·풍량이 없는 예전 기록도 그대로 읽는다", () => {
    const old = {
      profileId: "a",
      at: 1,
      cabinTemp: 8,
      settings: { seatHeat: 2, steeringHeat: 1, cabinTarget: 23 },
    };
    expect(comfortRecordSchema.parse(old)).toEqual(old);
  });

  it("모르는 바람 방향이나 음수 통풍은 받지 않는다", () => {
    const base = { profileId: "a", at: 1, cabinTemp: null };
    expect(
      comfortRecordSchema.safeParse({
        ...base,
        settings: { fanDirection: "ceiling" },
      }).success,
    ).toBe(false);
    expect(
      comfortRecordSchema.safeParse({ ...base, settings: { seatVent: -1 } })
        .success,
    ).toBe(false);
  });
});

describe("recommendComfort", () => {
  it("기록이 없으면 추천하지 않는다", () => {
    expect(recommendComfort([], 10)).toBeNull();
  });

  it("탈 때 실내 온도가 비슷했던 날의 설정을 고른다", () => {
    const records = [
      record(1, 5, { seatHeat: 3, steeringHeat: 1, cabinTarget: 24 }),
      record(2, 7, { seatHeat: 2, steeringHeat: 1, cabinTarget: 23 }),
      record(3, 30, { seatHeat: -2, steeringHeat: 0, cabinTarget: 20 }),
    ];
    const winter = recommendComfort(records, 6);
    expect(winter?.similarCabin).toBe(true);
    expect(winter?.basedOn).toBe(2);
    expect(winter?.settings).toEqual({
      seatHeat: 3,
      steeringHeat: 1,
      cabinTarget: 23.5,
    });
    expect(recommendComfort(records, 29)?.settings).toEqual({
      seatHeat: -2,
      steeringHeat: 0,
      cabinTarget: 20,
    });
  });

  it("비슷한 날이 없거나 실내 온도를 모르면 최근 기록으로 추천한다", () => {
    const records = [
      record(1, 30, { seatHeat: 0 }),
      record(2, 31, { seatHeat: 1 }),
      record(3, null, { seatHeat: 1 }),
    ];
    const result = recommendComfort(records, 5);
    expect(result?.similarCabin).toBe(false);
    expect(result?.settings.seatHeat).toBe(1);
    expect(recommendComfort(records, null)?.basedOn).toBe(3);
  });

  it("한 번 다르게 켠 날에 흔들리지 않는다 (가운데 값)", () => {
    const records = [
      record(1, 10, { seatHeat: 2 }),
      record(2, 10, { seatHeat: 2 }),
      record(3, 10, { seatHeat: 0 }),
    ];
    expect(recommendComfort(records, 10)?.settings.seatHeat).toBe(2);
  });

  it("최근 5건만 본다", () => {
    const old = [1, 2, 3, 4, 5].map((at) => record(at, 10, { seatHeat: 0 }));
    const recent = [6, 7, 8, 9, 10].map((at) =>
      record(at, 10, { seatHeat: 3 }),
    );
    expect(recommendComfort([...old, ...recent], 10)?.settings.seatHeat).toBe(
      3,
    );
  });

  it("더운 날에는 통풍과 풍량을, 바람 방향은 가장 자주 고른 쪽을 추천한다", () => {
    const records = [
      record(1, 33, { seatVent: 3, fanSpeed: 6, fanDirection: "face" }),
      record(2, 31, { seatVent: 2, fanSpeed: 5, fanDirection: "faceFloor" }),
      record(3, 32, { seatVent: 2, fanSpeed: 7, fanDirection: "face" }),
      record(4, 6, { seatHeat: 2, fanSpeed: 2, fanDirection: "floor" }),
    ];
    expect(recommendComfort(records, 32)?.settings).toEqual({
      seatVent: 2,
      fanSpeed: 6,
      fanDirection: "face",
    });
  });

  it("바람 방향을 고른 횟수가 같으면 최근에 고른 쪽을 추천한다", () => {
    const records = [
      record(1, 20, { fanDirection: "floor" }),
      record(2, 20, { fanDirection: "face" }),
    ];
    expect(recommendComfort(records, 20)?.settings.fanDirection).toBe("face");
  });

  it("자동 공조로 달린 날(풍량 기록 없음)은 빼고 직접 맞춘 날의 풍량만 본다", () => {
    const records = [
      record(1, 20, { cabinTarget: 22, fanSpeed: 3, fanDirection: "face" }),
      record(2, 20, { cabinTarget: 22 }),
      record(3, 20, { cabinTarget: 23 }),
    ];
    expect(recommendComfort(records, 20)?.settings).toEqual({
      cabinTarget: 22,
      fanSpeed: 3,
      fanDirection: "face",
    });
  });

  it("예전 기록(통풍·풍량 없음)만 있으면 그 항목은 추천하지 않는다", () => {
    const records = [
      record(1, 10, { seatHeat: 2, cabinTarget: 23 }),
      record(2, 10, { seatHeat: 2, cabinTarget: 24 }),
    ];
    expect(recommendComfort(records, 10)?.settings).toEqual({
      seatHeat: 2,
      cabinTarget: 23.5,
    });
  });

  it("열선과 통풍을 함께 추천하지 않는다: 켠 날이 섞이면 최근에 켠 쪽만 남긴다", () => {
    const heatThenVent = [
      record(1, 18, { seatHeat: 2, seatVent: 0 }),
      record(2, 18, { seatHeat: 0, seatVent: 2 }),
    ];
    expect(recommendComfort(heatThenVent, 18)?.settings).toEqual({
      seatHeat: 0,
      seatVent: 1,
    });
    const ventThenHeat = [
      record(1, 18, { seatHeat: 0, seatVent: 2 }),
      record(2, 18, { seatHeat: 2, seatVent: 0 }),
    ];
    expect(recommendComfort(ventThenHeat, 18)?.settings).toEqual({
      seatHeat: 1,
      seatVent: 0,
    });
  });
});

describe("comfortChanges", () => {
  const state = {
    seatHeat: { value: 0, min: -3, max: 3 },
    steeringHeat: { value: 1, min: 0, max: 1 },
    cabinTarget: { value: 22, min: 17, max: 27 },
  };

  it("지금과 다른 항목만 범위 안 값으로 남긴다", () => {
    expect(
      comfortChanges(state, { seatHeat: 5, steeringHeat: 1, cabinTarget: 30 }),
    ).toEqual({ seatHeat: 3, cabinTarget: 27 });
  });

  it("차량이 지원하지 않는 항목은 뺀다", () => {
    expect(
      comfortChanges({ cabinTarget: state.cabinTarget }, { seatHeat: 2 }),
    ).toEqual({});
  });

  const fanState = {
    seatHeat: { value: 2, min: 0, max: 3 },
    seatVent: { value: 0, min: 0, max: 3 },
    fanSpeed: { value: 2, min: 1, max: 8 },
    fanDirection: {
      value: "floor" as const,
      options: ["face" as const, "floor" as const, "faceFloor" as const],
    },
  };
  const summer = {
    seatHeat: 0,
    seatVent: 5,
    fanSpeed: 12,
    fanDirection: "face" as const,
  };

  it("통풍·풍량·바람 방향도 지금과 다른 항목만 범위 안 값으로 남긴다", () => {
    expect(comfortChanges({ ...fanState, fanMode: "manual" }, summer)).toEqual({
      seatHeat: 0,
      seatVent: 3,
      fanSpeed: 8,
      fanDirection: "face",
    });
    expect(
      comfortChanges(fanState, {
        seatHeat: 2,
        seatVent: 0,
        fanSpeed: 2,
        fanDirection: "floor",
      }),
    ).toEqual({});
  });

  it("자동 공조이거나 공조가 꺼져 있으면 풍량과 바람 방향은 덮어쓰지 않는다", () => {
    expect(comfortChanges({ ...fanState, fanMode: "auto" }, summer)).toEqual({
      seatHeat: 0,
      seatVent: 3,
    });
    expect(comfortChanges({ ...fanState, fanMode: "off" }, summer)).toEqual({
      seatHeat: 0,
      seatVent: 3,
    });
  });

  it("이 차량에 없는 바람 방향은 보내지 않는다", () => {
    expect(
      comfortChanges(fanState, { fanDirection: "faceFloorDefrost" }),
    ).toEqual({});
  });
});

describe("사이드미러 열선·무드등", () => {
  const cabin = {
    mirrorHeat: { value: 1, min: 0, max: 1 },
    ambientOn: true,
    ambientBrightness: { value: 3, min: 1, max: 5 },
    ambientColor: 7,
  };

  it("출발할 때의 사이드미러 열선과 무드등 켜짐·밝기·색을 기록하고, 저장 형식 검증을 통과한다", () => {
    const made = toComfortRecord("a", 1, { ...cabin, cabinCurrent: 2 });
    expect(made?.settings).toEqual({
      mirrorHeat: 1,
      ambientOn: true,
      ambientBrightness: 3,
      ambientColor: 7,
    });
    expect(comfortRecordSchema.safeParse(made).success).toBe(true);
  });

  it("무드등을 꺼 둔 날은 밝기와 색을 취향으로 남기지 않는다", () => {
    expect(toComfortSettings({ ...cabin, ambientOn: false })).toEqual({
      mirrorHeat: 1,
      ambientOn: false,
    });
  });

  it("차량 범위 밖 밝기나 정수가 아닌 색은 그 항목만 뺀다", () => {
    expect(
      toComfortSettings({
        ambientOn: true,
        ambientBrightness: { value: 9, min: 1, max: 5 },
        ambientColor: 1.5,
      }),
    ).toEqual({ ambientOn: true });
  });

  it("RGB 처럼 큰 색 값도 저장 형식 검증을 통과하고, 32비트를 넘는 값은 받지 않는다", () => {
    const parse = (ambientColor: number) =>
      comfortRecordSchema.safeParse(record(1, null, { ambientColor })).success;
    expect(parse(0xff8800)).toBe(true);
    expect(parse(-1)).toBe(true);
    expect(parse(2 ** 31)).toBe(false);
  });

  it("사이드미러 열선은 실내 온도가 비슷한 날의 기록으로 추천한다", () => {
    const records = [
      record(1, 2, { mirrorHeat: 1 }),
      record(2, 3, { mirrorHeat: 1 }),
      record(3, 28, { mirrorHeat: 0 }),
    ];
    expect(recommendComfort(records, 1)?.settings.mirrorHeat).toBe(1);
    expect(recommendComfort(records, 30)?.settings.mirrorHeat).toBe(0);
  });

  it("무드등은 실내 온도와 상관없이 최근 기록으로 추천한다", () => {
    const records = [
      record(1, 2, { seatHeat: 3 }),
      record(2, 28, { ambientOn: true, ambientBrightness: 4, ambientColor: 7 }),
      record(3, 30, { ambientOn: true, ambientBrightness: 2, ambientColor: 7 }),
      record(4, 29, { ambientOn: true, ambientBrightness: 3, ambientColor: 5 }),
    ];
    // 지금은 추운 날: 온도 항목은 추운 날 기록 하나만 보지만 무드등은 더운 날의 기록에서 고른다.
    const picked = recommendComfort(records, 1);
    expect(picked?.similarCabin).toBe(true);
    expect(picked?.settings).toEqual({
      seatHeat: 3,
      ambientOn: true,
      ambientBrightness: 3,
      ambientColor: 7,
    });
  });

  it("평소 무드등을 꺼 두면 밝기와 색은 추천하지 않는다", () => {
    const records = [
      record(1, 20, { ambientOn: true, ambientBrightness: 4, ambientColor: 7 }),
      record(2, 20, { ambientOn: false }),
      record(3, 20, { ambientOn: false }),
    ];
    expect(recommendComfort(records, 20)?.settings).toEqual({
      ambientOn: false,
    });
  });

  it("무드등 기록이 없는 예전 기록만 있으면 무드등을 추천하지 않는다", () => {
    const picked = recommendComfort([record(1, 20, { seatHeat: 1 })], 20);
    expect(hasAmbient(picked?.settings ?? {})).toBe(false);
  });

  it("지금과 다른 항목만 바꾸고 밝기는 차량 범위 안으로 맞춘다", () => {
    expect(
      comfortChanges(cabin, {
        mirrorHeat: 1,
        ambientOn: true,
        ambientBrightness: 8,
        ambientColor: 7,
      }),
    ).toEqual({ ambientBrightness: 5 });
    expect(comfortChanges(cabin, { mirrorHeat: 0, ambientColor: 2 })).toEqual({
      mirrorHeat: 0,
      ambientColor: 2,
    });
  });

  it("무드등을 끄는 것으로 맞출 때와 꺼진 채 둘 때는 밝기와 색을 건드리지 않는다", () => {
    const wanted = { ambientBrightness: 5, ambientColor: 2 };
    expect(comfortChanges(cabin, { ...wanted, ambientOn: false })).toEqual({
      ambientOn: false,
    });
    expect(comfortChanges({ ...cabin, ambientOn: false }, wanted)).toEqual({});
    // 꺼져 있던 무드등을 켜면서 밝기·색도 함께 맞춘다.
    expect(
      comfortChanges(
        { ...cabin, ambientOn: false },
        { ...wanted, ambientOn: true },
      ),
    ).toEqual({ ambientOn: true, ambientBrightness: 5, ambientColor: 2 });
  });

  it("차량이 지원하지 않는 무드등·사이드미러 열선은 보내지 않는다", () => {
    expect(
      comfortChanges(
        { seatHeat: { value: 0, min: 0, max: 3 } },
        {
          mirrorHeat: 1,
          ambientOn: true,
          ambientBrightness: 3,
          ambientColor: 7,
        },
      ),
    ).toEqual({});
  });
});
