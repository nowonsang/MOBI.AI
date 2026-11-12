import {
  DEFAULT_DRIVE_CONTEXT,
  DRIVE_CONTEXT_LABEL,
  DRIVE_CONTEXTS,
  parseDriveContext,
} from "./bodyfit-drive-context";

describe("DRIVE_CONTEXTS", () => {
  it("고를 수 있는 상황마다 화면에 보일 이름이 있다", () => {
    expect([...DRIVE_CONTEXTS].sort()).toEqual(
      Object.keys(DRIVE_CONTEXT_LABEL).sort(),
    );
  });

  it("고르지 않았을 때의 상황(평소)이 맨 앞에 온다", () => {
    expect(DRIVE_CONTEXTS[0]).toBe(DEFAULT_DRIVE_CONTEXT);
    expect(DRIVE_CONTEXT_LABEL[DEFAULT_DRIVE_CONTEXT]).toBe("평소");
  });

  it("한 섹션의 선택지 7개를 넘지 않는다", () => {
    expect(DRIVE_CONTEXTS.length).toBeLessThanOrEqual(7);
  });
});

describe("parseDriveContext", () => {
  it("아는 상황은 그대로 읽는다", () => {
    expect(parseDriveContext("long")).toBe("long");
    expect(parseDriveContext("usual")).toBe("usual");
  });

  it("모르는 값·빈 값·문자열이 아닌 값은 받지 않는다", () => {
    expect(parseDriveContext("highway")).toBeNull();
    expect(parseDriveContext("")).toBeNull();
    expect(parseDriveContext(undefined)).toBeNull();
    expect(parseDriveContext(["long"])).toBeNull();
  });
});
