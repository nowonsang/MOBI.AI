import {
  CITY_DRIVE_MAX_METERS,
  describeDriveSuggestion,
  LONG_DRIVE_MIN_METERS,
  LONG_DRIVE_MIN_SECONDS,
  suggestDriveContext,
} from "./bodyfit-drive-suggestion";

const route = (km: number, minutes: number) => ({
  remainDistance: Math.round(km * 1_000),
  remainTime: minutes * 60,
});

describe("suggestDriveContext", () => {
  it("예상 시간이 60분 이상이면 장거리를 제안한다", () => {
    expect(suggestDriveContext(route(55, 60), "usual")?.context).toBe("long");
    expect(
      suggestDriveContext(
        { remainDistance: 55_000, remainTime: LONG_DRIVE_MIN_SECONDS - 1 },
        "usual",
      ),
    ).toBeNull();
  });

  it("시간이 짧게 잡혀도 80km 이상이면 장거리를 제안한다", () => {
    expect(suggestDriveContext(route(120, 55), "usual")?.context).toBe("long");
    expect(
      suggestDriveContext(
        { remainDistance: LONG_DRIVE_MIN_METERS, remainTime: 50 * 60 },
        "usual",
      )?.context,
    ).toBe("long");
  });

  it("20km 이하의 짧은 경로는 시내를 제안한다", () => {
    expect(suggestDriveContext(route(8, 25), "usual")?.context).toBe("city");
    expect(
      suggestDriveContext(
        { remainDistance: CITY_DRIVE_MAX_METERS, remainTime: 40 * 60 },
        "usual",
      )?.context,
    ).toBe("city");
  });

  it("가까워도 막혀서 60분 이상 걸리면 장거리가 먼저다", () => {
    expect(suggestDriveContext(route(18, 70), "usual")?.context).toBe("long");
  });

  it("시내보다 멀고 장거리보다 짧은 경로는 제안하지 않는다 (출퇴근인지 알 수 없다)", () => {
    expect(suggestDriveContext(route(35, 45), "usual")).toBeNull();
  });

  it("출퇴근은 제안하지 않는다", () => {
    const contexts = [
      route(1, 3),
      route(8, 25),
      route(35, 45),
      route(120, 90),
      route(400, 300),
    ].map((each) => suggestDriveContext(each, "usual")?.context);
    expect(contexts).not.toContain("commute");
  });

  it("운전자가 이미 상황을 골랐으면 제안하지 않는다", () => {
    expect(suggestDriveContext(route(120, 90), "city")).toBeNull();
    expect(suggestDriveContext(route(120, 90), "commute")).toBeNull();
    expect(suggestDriveContext(route(120, 90), "long")).toBeNull();
  });

  it("목적지가 없거나(null) 형식이 다른 값이면 제안하지 않는다", () => {
    expect(suggestDriveContext(null, "usual")).toBeNull();
    expect(suggestDriveContext(undefined, "usual")).toBeNull();
    expect(suggestDriveContext({}, "usual")).toBeNull();
    expect(
      suggestDriveContext(
        { remainDistance: "120000", remainTime: 5400 },
        "usual",
      ),
    ).toBeNull();
  });

  it("말이 안 되는 값(0 이하, 너무 큰 값, 소수)은 받지 않는다", () => {
    expect(
      suggestDriveContext({ remainDistance: 0, remainTime: 0 }, "usual"),
    ).toBeNull();
    expect(
      suggestDriveContext({ remainDistance: -5, remainTime: 600 }, "usual"),
    ).toBeNull();
    expect(
      suggestDriveContext({ remainDistance: 5_000, remainTime: -1 }, "usual"),
    ).toBeNull();
    expect(
      suggestDriveContext(
        { remainDistance: 9_000_000, remainTime: 600 },
        "usual",
      ),
    ).toBeNull();
    expect(
      suggestDriveContext(
        { remainDistance: 5_000, remainTime: 999_999 },
        "usual",
      ),
    ).toBeNull();
    expect(
      suggestDriveContext(
        { remainDistance: 5_000.5, remainTime: 600 },
        "usual",
      ),
    ).toBeNull();
  });

  it("거리·시간 말고는 아무것도 들고 나오지 않는다 (좌표·이름이 섞여 와도)", () => {
    const suggestion = suggestDriveContext(
      { ...route(120, 90), latitude: 37.5, name: "어딘가" },
      "usual",
    );
    expect(suggestion).toEqual({
      context: "long",
      distanceMeters: 120_000,
      durationSeconds: 5_400,
    });
  });
});

describe("describeDriveSuggestion", () => {
  const describeRoute = (km: number, minutes: number) =>
    describeDriveSuggestion(suggestDriveContext(route(km, minutes), "usual")!);

  it("장거리는 거리와 시간을 말하고 장거리 자세를 묻는다", () => {
    expect(describeRoute(120, 90)).toBe(
      "목적지까지 120km, 1시간 30분쯤이에요. 장거리 자세로 볼까요?",
    );
    expect(describeRoute(200, 120)).toBe(
      "목적지까지 200km, 2시간쯤이에요. 장거리 자세로 볼까요?",
    );
  });

  it("시내는 10km 미만이면 소수 한 자리까지 보여 준다", () => {
    expect(describeRoute(3.24, 12)).toBe(
      "목적지까지 3.2km, 12분쯤이에요. 시내 자세로 볼까요?",
    );
  });

  it("1km 미만이거나 1분이 안 되면 숫자를 지어내지 않는다", () => {
    expect(
      describeDriveSuggestion({
        context: "city",
        distanceMeters: 400,
        durationSeconds: 20,
      }),
    ).toBe("목적지까지 1km 안쪽 거리예요. 시내 자세로 볼까요?");
  });
});
