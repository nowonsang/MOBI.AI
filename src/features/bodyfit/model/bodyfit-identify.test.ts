import {
  AUTO_START_CONFIDENCE,
  guessDriver,
  type Boarding,
} from "./bodyfit-identify";

// 시간대 판단은 기기 현지 시각으로 한다. 테스트도 현지 시각으로 만든다.
// 2026-11-02 은 월요일, 2026-11-07 은 토요일이다.
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute).getTime();

const rides = (profileId: string, ...times: number[]): Boarding[] =>
  times.map((time) => ({ profileId, at: time }));

const guess = (boardings: Boarding[], now: number, ids = ["mom", "dad"]) =>
  guessDriver({ profileIds: ids, boardings, now });

describe("guessDriver", () => {
  it("운전자가 없으면 추측하지 않는다", () => {
    expect(guess([], at(9, 8), [])).toBeNull();
  });

  it("운전자가 한 명이면 기록이 없어도 확실히 그 사람이다", () => {
    expect(guess([], at(9, 8), ["mom"])).toEqual({
      profileId: "mom",
      confidence: 1,
      reason: "only",
    });
  });

  it("운전자가 여럿인데 기록이 없으면 추측하지 않는다", () => {
    expect(guess([], at(9, 8))).toBeNull();
  });

  it("평일 아침에 늘 타던 사람을 높은 확률로 고른다 (마지막 운전자가 아니어도)", () => {
    const boardings = [
      ...rides("mom", at(2, 8), at(3, 8, 10), at(4, 7, 50), at(5, 8, 5)),
      ...rides("dad", at(2, 19), at(3, 19), at(4, 19), at(8, 19)),
    ];
    const result = guess(boardings, at(9, 8, 20));
    expect(result?.profileId).toBe("mom");
    expect(result?.reason).toBe("usual-time");
    expect(result?.confidence).toBeGreaterThanOrEqual(AUTO_START_CONFIDENCE);
  });

  it("주말에는 주말에 타던 사람을 고른다", () => {
    const boardings = [
      ...rides("mom", at(2, 10), at(3, 10), at(4, 10)),
      ...rides("dad", at(1, 10), at(7, 10), at(8, 10)),
    ];
    expect(guess(boardings, at(14, 10))?.profileId).toBe("dad");
  });

  it("근거가 엇갈리면 확률이 낮아 자동으로 넘어가지 않게 한다", () => {
    const boardings = [...rides("mom", at(9, 8)), ...rides("dad", at(9, 9))];
    const result = guess(boardings, at(9, 14));
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeLessThan(AUTO_START_CONFIDENCE);
  });

  it("번갈아 타는 집은 앞사람 다음에 누가 타는지를 배운다", () => {
    // 하루 종일 같은 시간대에 엄마 → 아빠 → 엄마 → 아빠 순서로 탄다
    const boardings = [
      ...rides("mom", at(2, 12), at(3, 12), at(4, 12), at(5, 12)),
      ...rides("dad", at(2, 13), at(3, 13), at(4, 13), at(5, 13)),
    ];
    // 방금 엄마가 탔다 (5일 12시가 마지막이 아니게 6일 12시 기록을 더한다)
    const result = guess(
      [...boardings, ...rides("mom", at(6, 12))],
      at(6, 12, 30),
    );
    expect(result?.profileId).toBe("dad");
    expect(result?.reason).toBe("after-last");
  });

  it("자정을 사이에 둔 시각도 가까운 시간대로 본다", () => {
    const boardings = [
      ...rides("night", at(5, 23, 30), at(6, 23, 40)),
      ...rides("day", at(6, 12), at(7, 12)),
    ];
    expect(guess(boardings, at(9, 0, 20), ["night", "day"])?.profileId).toBe(
      "night",
    );
  });

  it("지운 운전자와 미래 시각의 기록은 쓰지 않는다", () => {
    const boardings = [
      ...rides("deleted", at(9, 8), at(8, 8), at(7, 8)),
      ...rides("mom", at(10, 8)),
      ...rides("dad", at(6, 8)),
    ];
    expect(guess(boardings, at(9, 8))?.profileId).toBe("dad");
  });

  it("확률은 0~1 사이다", () => {
    const boardings = [
      ...rides("mom", at(2, 8), at(3, 8)),
      ...rides("dad", at(4, 20)),
    ];
    const result = guess(boardings, at(9, 8))!;
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
