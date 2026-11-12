import {
  comfortChanges,
  recommendComfort,
  toComfortSettings,
} from "./bodyfit-comfort";
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
});
