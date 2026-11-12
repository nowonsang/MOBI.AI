import { SEAT_AXES } from "@/shared/pleos/pleos.types";

import {
  groupSeatAxes,
  recommendationForVehicle,
} from "./bodyfit-axis-group";
import type { SeatRatios } from "./bodyfit.types";

const recommended: SeatRatios = {
  foreAft: 0.5,
  height: 0.4,
  backrest: 0.6,
  tilt: 0.5,
  depth: 0.45,
  headrestHeight: 0.55,
  beltHeight: 0.5,
};

describe("recommendationForVehicle", () => {
  it("차량 값을 읽기 전에는 기본 네 축만 보여 준다", () => {
    expect(Object.keys(recommendationForVehicle(recommended, null))).toEqual([
      "foreAft",
      "height",
      "backrest",
      "tilt",
    ]);
  });

  it("좌판 길이·헤드레스트·안전벨트는 차량이 위치를 알려 줄 때만 넣는다", () => {
    const shown = recommendationForVehicle(recommended, {
      foreAft: 0.2,
      depth: 0.1,
      beltHeight: 0,
    });
    expect(shown.depth).toBe(0.45);
    expect(shown.beltHeight).toBe(0.5);
    expect(shown.headrestHeight).toBeUndefined();
  });

  it("기본 네 축은 차량이 알려 주지 않아도 추천을 남긴다", () => {
    const shown = recommendationForVehicle(recommended, { foreAft: 0.2 });
    expect(shown).toEqual({
      foreAft: 0.5,
      height: 0.4,
      backrest: 0.6,
      tilt: 0.5,
    });
  });

  it("추천에 없는 축은 만들지 않는다", () => {
    expect(
      recommendationForVehicle({ foreAft: 0.5 }, { depth: 0.3, height: 0.2 }),
    ).toEqual({ foreAft: 0.5 });
  });
});

describe("groupSeatAxes", () => {
  const items = (axes: readonly (typeof SEAT_AXES)[number][]) =>
    axes.map((axis) => ({ axis }));

  it("모든 축을 자세 / 머리·벨트 두 묶음으로 빠짐없이 나눈다", () => {
    const groups = groupSeatAxes(items(SEAT_AXES));
    expect(groups.map((group) => group.id)).toEqual(["posture", "headBelt"]);
    expect(groups[0]?.items.map((item) => item.axis)).toEqual([
      "foreAft",
      "height",
      "backrest",
      "tilt",
      "depth",
    ]);
    expect(groups[1]?.items.map((item) => item.axis)).toEqual([
      "headrestHeight",
      "beltHeight",
    ]);
    expect(groups.flatMap((group) => group.items)).toHaveLength(
      SEAT_AXES.length,
    );
  });

  it("기본 네 축만 있는 차량은 묶음이 하나라 나누지 않는다", () => {
    const groups = groupSeatAxes(
      items(["foreAft", "height", "backrest", "tilt"]),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.id).toBe("posture");
  });

  it("항목이 없으면 묶음도 없다", () => {
    expect(groupSeatAxes([])).toEqual([]);
  });
});
