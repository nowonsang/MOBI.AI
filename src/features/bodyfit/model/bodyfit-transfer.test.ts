import { DRIVE_CONTEXTS } from "./bodyfit-drive-context";
import {
  learnOffsets,
  learnRemembered,
  MAX_OFFSET,
  MAX_RECORDS,
} from "./bodyfit-learning";
import {
  BASELINE_AXES,
  LEARNED_ONLY_AXES,
  recommendBaseline,
  recommendSeat,
} from "./bodyfit-recommend";
import {
  buildTransfer,
  decodeTransfer,
  encodeTransfer,
  MAX_TRANSFER_TEXT_LENGTH,
  resolveImportName,
  SAMPLE_TRANSFER,
  SAMPLE_TRANSFER_CODE,
  toImportedAdjustments,
  TRANSFER_OFFSET_AXES,
  TRANSFER_REMEMBERED_AXES,
  TRANSFER_VERSION,
  transferRecordCount,
  type PostureTransfer,
} from "./bodyfit-transfer";
import { seatAdjustmentSchema } from "./bodyfit.schema";
import type {
  BodyProfile,
  DriveContext,
  SeatAdjustment,
  SeatRatios,
} from "./bodyfit.types";

const profile: BodyProfile = {
  id: "p1",
  name: "운전자 A",
  heightCm: 175,
  weightKg: 70,
  sittingHeightCm: 92,
  voiceConsent: true,
  postureConsent: false,
  createdAt: 1,
  consentedAt: 1,
};

const baseline = recommendBaseline(profile);

const record = (
  at: number,
  offsets: SeatRatios,
  context: DriveContext = "usual",
  extra: SeatRatios = {},
): SeatAdjustment => {
  const final: SeatRatios = { ...extra };
  for (const axis of BASELINE_AXES) {
    const offset = offsets[axis];
    if (offset !== undefined) final[axis] = baseline[axis] + offset;
  }
  return {
    profileId: "p1",
    at,
    baseline,
    final,
    source: "drive-start",
    context,
  };
};

/** 코드의 한 필드만 바꾼다 (깨진·조작된 코드를 만들 때) */
const tamper = (change: (wire: Record<string, unknown>) => void): string => {
  const wire = JSON.parse(SAMPLE_TRANSFER_CODE) as Record<string, unknown>;
  change(wire);
  return JSON.stringify(wire);
};

const reasonOf = (text: unknown) => {
  const result = decodeTransfer(text);
  return result.ok ? "ok" : result.reason;
};

describe("코드 형식", () => {
  it("코드의 축 목록은 앱이 다루는 축을 모두 담는다", () => {
    expect([...TRANSFER_OFFSET_AXES].sort()).toEqual([...BASELINE_AXES].sort());
    expect([...TRANSFER_REMEMBERED_AXES].sort()).toEqual(
      [...LEARNED_ONLY_AXES].sort(),
    );
  });

  it("한글 이름도 ASCII 글자로만 적는다 (읽는 쪽의 글자 인코딩 추측에 기대지 않는다)", () => {
    expect(SAMPLE_TRANSFER_CODE).toMatch(/^[\x20-\x7e]+$/);
  });

  it("종류와 버전이 맨 앞에 온다", () => {
    expect(SAMPLE_TRANSFER_CODE.startsWith(`{"k":"bodyfit","v":1,`)).toBe(true);
  });

  it("동의 여부·시각·운전자 ID 는 담지 않는다 (필요한 값만)", () => {
    const code = encodeTransfer(buildTransfer(profile, [record(1, {})]));
    expect(Object.keys(JSON.parse(code)).sort()).toEqual(
      ["h", "k", "l", "n", "s", "v", "w"].sort(),
    );
    expect(code).not.toContain("p1");
  });

  it("가장 큰 정상 코드도 크기 한계 안에 들어온다", () => {
    const largest: PostureTransfer = {
      name: "가".repeat(20),
      heightCm: 199.5,
      weightKg: 199.5,
      sittingHeightCm: 119.5,
      learning: DRIVE_CONTEXTS.map((context) => ({
        context,
        count: MAX_RECORDS,
        offsets: Object.fromEntries(
          TRANSFER_OFFSET_AXES.map((axis) => [axis, -MAX_OFFSET]),
        ),
        remembered: Object.fromEntries(
          TRANSFER_REMEMBERED_AXES.map((axis) => [axis, 1]),
        ),
      })),
    };
    const code = encodeTransfer(largest);
    expect(code.length).toBeLessThanOrEqual(MAX_TRANSFER_TEXT_LENGTH);
    expect(decodeTransfer(code)).toEqual({ ok: true, transfer: largest });
  });
});

describe("정상 왕복", () => {
  it("내보낸 코드를 읽으면 같은 내용이 나온다", () => {
    expect(decodeTransfer(SAMPLE_TRANSFER_CODE)).toEqual({
      ok: true,
      transfer: SAMPLE_TRANSFER,
    });
  });

  it("앉은키를 모르는 운전자와 기록이 없는 운전자도 옮긴다", () => {
    const transfer = buildTransfer({ ...profile, sittingHeightCm: null }, []);
    expect(transfer.learning).toEqual([]);
    expect(decodeTransfer(encodeTransfer(transfer))).toEqual({
      ok: true,
      transfer,
    });
  });

  it("보정 한계(±0.3)에 닿은 값도 그대로 옮긴다", () => {
    const transfer: PostureTransfer = {
      ...SAMPLE_TRANSFER,
      learning: [
        {
          context: "usual",
          count: 1,
          offsets: { foreAft: MAX_OFFSET, backrest: -MAX_OFFSET },
          remembered: { lumbar: 0, headrestAngle: 1 },
        },
      ],
    };
    expect(decodeTransfer(encodeTransfer(transfer))).toEqual({
      ok: true,
      transfer,
    });
  });

  it("상황별 기록을 따로 요약하고 최근에 쓴 상황을 앞에 둔다", () => {
    const transfer = buildTransfer(profile, [
      record(1, { backrest: 0.05 }, "usual"),
      record(2, { backrest: 0.05 }, "usual"),
      record(3, { backrest: -0.1 }, "long"),
    ]);
    expect(transfer.learning.map((item) => item.context)).toEqual([
      "long",
      "usual",
    ]);
    expect(transfer.learning[0].count).toBe(1);
    expect(transfer.learning[0].offsets.backrest).toBeCloseTo(-0.1);
    expect(transfer.learning[1].count).toBe(2);
    expect(transfer.learning[1].offsets.backrest).toBeCloseTo(0.05);
    expect(transferRecordCount(transfer)).toBe(3);
  });

  it("차량 원시 값이나 시트 위치 자체가 아니라 보정(차이)만 담는다", () => {
    const transfer = buildTransfer(profile, [record(1, { foreAft: -0.05 })]);
    // 위치(baseline + offset)가 아니라 차이다.
    expect(transfer.learning[0].offsets.foreAft).toBeCloseTo(-0.05);
    expect(transfer.learning[0].offsets.foreAft).not.toBeCloseTo(
      baseline.foreAft - 0.05,
    );
  });
});

describe("신뢰하지 않는 입력", () => {
  it("글자가 아니면 받지 않는다", () => {
    expect(reasonOf(null)).toBe("malformed");
    expect(reasonOf({ k: "bodyfit" })).toBe("malformed");
  });

  it("다른 용도의 QR(주소, 일반 글자, 다른 JSON)은 BodyFit 코드가 아니라고 알린다", () => {
    expect(reasonOf("https://example.com")).toBe("notBodyfit");
    expect(reasonOf("")).toBe("notBodyfit");
    expect(reasonOf("[1,2,3]")).toBe("notBodyfit");
    expect(reasonOf('{"k":"other","v":1}')).toBe("notBodyfit");
  });

  it("잘린 코드는 받지 않는다", () => {
    expect(reasonOf(SAMPLE_TRANSFER_CODE.slice(0, 40))).toBe("malformed");
  });

  it("너무 큰 코드는 읽기 전에 거절한다", () => {
    const huge = tamper((wire) => {
      wire.n = "가".repeat(MAX_TRANSFER_TEXT_LENGTH);
    });
    expect(reasonOf(huge)).toBe("tooLarge");
    // 한계를 넘는 정상 형식도 마찬가지다 (공백을 붙여 길이만 늘린 코드).
    expect(
      reasonOf(SAMPLE_TRANSFER_CODE + " ".repeat(MAX_TRANSFER_TEXT_LENGTH)),
    ).toBe("tooLarge");
  });

  it("다른 버전의 코드는 받지 않고 버전이 다르다고 알린다", () => {
    expect(reasonOf(tamper((wire) => (wire.v = TRANSFER_VERSION + 1)))).toBe(
      "version",
    );
    expect(reasonOf(tamper((wire) => (wire.v = 0)))).toBe("version");
    expect(reasonOf(tamper((wire) => (wire.v = "1")))).toBe("malformed");
    expect(reasonOf(tamper((wire) => delete wire.v))).toBe("malformed");
  });

  it.each([
    ["키가 범위 밖", (wire: Record<string, unknown>) => (wire.h = 500)],
    ["키가 너무 작음", (wire: Record<string, unknown>) => (wire.h = 10)],
    ["몸무게가 범위 밖", (wire: Record<string, unknown>) => (wire.w = 999)],
    ["앉은키가 범위 밖", (wire: Record<string, unknown>) => (wire.s = 300)],
    [
      "보정이 ±0.3 을 넘음",
      (wire: Record<string, unknown>) =>
        (wire.l = [["usual", 3, [900, 0, 0, 0, 0, 0, 0], [null, null]]]),
    ],
    [
      "보정이 −0.3 보다 작음",
      (wire: Record<string, unknown>) =>
        (wire.l = [["usual", 3, [0, -301, 0, 0, 0, 0, 0], [null, null]]]),
    ],
    [
      "기억한 위치가 0~1 밖",
      (wire: Record<string, unknown>) =>
        (wire.l = [["usual", 3, [0, 0, 0, 0, 0, 0, 0], [1500, null]]]),
    ],
    [
      "기록 수가 한계를 넘음",
      (wire: Record<string, unknown>) =>
        (wire.l = [["usual", 9999, [0, 0, 0, 0, 0, 0, 0], [null, null]]]),
    ],
  ])("범위를 벗어난 값은 잘라서 받지 않고 거절한다: %s", (_name, change) => {
    expect(reasonOf(tamper(change))).toBe("outOfRange");
  });

  it.each([
    ["이름이 없음", (wire: Record<string, unknown>) => (wire.n = "  ")],
    [
      "이름이 너무 김",
      (wire: Record<string, unknown>) => (wire.n = "가".repeat(21)),
    ],
    ["이름에 줄바꿈", (wire: Record<string, unknown>) => (wire.n = "가\n나")],
    ["키가 글자", (wire: Record<string, unknown>) => (wire.h = "175")],
    ["몸무게가 없음", (wire: Record<string, unknown>) => delete wire.w],
    ["모르는 필드", (wire: Record<string, unknown>) => (wire.admin = true)],
    [
      "모르는 상황",
      (wire: Record<string, unknown>) =>
        (wire.l = [["racing", 1, [0, 0, 0, 0, 0, 0, 0], [null, null]]]),
    ],
    [
      "축 수가 다름",
      (wire: Record<string, unknown>) =>
        (wire.l = [["usual", 1, [0, 0, 0], [null, null]]]),
    ],
    [
      "보정이 정수가 아님",
      (wire: Record<string, unknown>) =>
        (wire.l = [["usual", 1, [0.5, 0, 0, 0, 0, 0, 0], [null, null]]]),
    ],
    [
      "같은 상황이 두 번",
      (wire: Record<string, unknown>) =>
        (wire.l = [
          ["usual", 1, [0, 0, 0, 0, 0, 0, 0], [null, null]],
          ["usual", 1, [0, 0, 0, 0, 0, 0, 0], [null, null]],
        ]),
    ],
    [
      "상황이 너무 많음",
      (wire: Record<string, unknown>) =>
        (wire.l = Array.from({ length: 5 }, () => [
          "usual",
          1,
          [0, 0, 0, 0, 0, 0, 0],
          [null, null],
        ])),
    ],
    ["학습이 목록이 아님", (wire: Record<string, unknown>) => (wire.l = "x")],
  ])("형식이 틀리면 받지 않는다: %s", (_name, change) => {
    expect(reasonOf(tamper(change))).toBe("malformed");
  });

  it("범위 오류와 형식 오류가 섞이면 형식 오류로 본다", () => {
    expect(
      reasonOf(
        tamper((wire) => {
          wire.h = 500;
          wire.extra = 1;
        }),
      ),
    ).toBe("malformed");
  });
});

describe("toImportedAdjustments", () => {
  const imported = (transfer: PostureTransfer, to: BodyProfile = profile) =>
    toImportedAdjustments(transfer, to, 1_000_000);

  it("가져온 차에서 원래 차와 같은 보정으로 추천한다", () => {
    const history = [
      record(1, { backrest: 0.06, foreAft: -0.04 }),
      record(2, { backrest: 0.06, foreAft: -0.04 }),
      record(3, { backrest: 0.06, foreAft: -0.04 }),
    ];
    const decoded = decodeTransfer(
      encodeTransfer(buildTransfer(profile, history)),
    );
    if (!decoded.ok) throw new Error(decoded.reason);

    const there = { ...profile, id: "p2" };
    const records = imported(decoded.transfer, there);
    const before = learnOffsets(history, "usual");
    const after = learnOffsets(records, "usual");
    expect(after.backrest).toBeCloseTo(before.backrest ?? NaN, 3);
    expect(after.foreAft).toBeCloseTo(before.foreAft ?? NaN, 3);
    expect(recommendSeat(there, after).backrest).toBeCloseTo(
      recommendSeat(profile, before).backrest ?? NaN,
      3,
    );
  });

  it("상황별 보정도 따로 살아난다", () => {
    const records = imported(SAMPLE_TRANSFER);
    // 평소 5건 → 3건(그 상황만으로 보정하는 기준), 장거리 2건 → 2건
    expect(records.filter((item) => item.context === "usual")).toHaveLength(3);
    expect(records.filter((item) => item.context === "long")).toHaveLength(2);
    expect(learnOffsets(records, "usual").backrest).toBeCloseTo(0.06);
    // 장거리는 2건이라 전체 기록과 섞이지만 눕히는 쪽으로 간다.
    expect(learnOffsets(records, "long").backrest).toBeLessThan(
      learnOffsets(records, "usual").backrest ?? NaN,
    );
  });

  it("기억한 위치(허리 지지대)도 2건 이상이면 이 차에서 추천된다", () => {
    expect(
      learnRemembered(imported(SAMPLE_TRANSFER), "usual").lumbar,
    ).toBeCloseTo(0.6);
  });

  it("만든 기록은 저장 형식 검증을 통과하고 출처가 '가져옴'이다", () => {
    const records = imported(SAMPLE_TRANSFER);
    for (const item of records) {
      expect(seatAdjustmentSchema.safeParse(item).success).toBe(true);
      expect(item.source).toBe("imported");
      expect(item.profileId).toBe(profile.id);
    }
    expect(new Set(records.map((item) => item.at)).size).toBe(records.length);
    expect(Math.max(...records.map((item) => item.at))).toBe(1_000_000);
  });

  it("추천이 시트 범위(0~1)를 넘지 않게 자른다", () => {
    // 키가 아주 큰 운전자는 기본 추천이 맨 뒤(0)에 가깝다. 뒤로 더 미는 보정을 더해도 0 아래로 가지 않는다.
    const tall = { ...profile, heightCm: 200, sittingHeightCm: null };
    const records = imported(
      {
        ...SAMPLE_TRANSFER,
        learning: [
          {
            context: "usual",
            count: 3,
            offsets: { foreAft: -MAX_OFFSET },
            remembered: {},
          },
        ],
      },
      tall,
    );
    for (const item of records) {
      expect(item.final.foreAft).toBeGreaterThanOrEqual(0);
    }
  });

  it("보정이 없는 축은 만들지 않는다 (없는 값을 0 으로 채우지 않는다)", () => {
    const [first] = imported({
      ...SAMPLE_TRANSFER,
      learning: [
        {
          context: "usual",
          count: 1,
          offsets: { backrest: 0.1 },
          remembered: {},
        },
      ],
    });
    expect(Object.keys(first.final)).toEqual(["backrest"]);
  });

  it("학습 기록이 없는 코드는 기록을 만들지 않는다", () => {
    expect(imported({ ...SAMPLE_TRANSFER, learning: [] })).toEqual([]);
  });
});

describe("resolveImportName", () => {
  it("같은 이름이 없으면 그대로 쓴다", () => {
    expect(resolveImportName("운전자 A", ["운전자 B"])).toEqual({
      name: "운전자 A",
      renamed: false,
    });
  });

  it("같은 이름이 있으면 덮어쓰지 않고 번호를 붙인다", () => {
    expect(resolveImportName("운전자 A", ["운전자 A"])).toEqual({
      name: "운전자 A (2)",
      renamed: true,
    });
    expect(
      resolveImportName("운전자 A", ["운전자 A", "운전자 A (2)"]).name,
    ).toBe("운전자 A (3)");
  });

  it("번호를 붙여도 이름 길이 한계(20자)를 넘지 않는다", () => {
    const long = "가".repeat(20);
    const { name } = resolveImportName(long, [long]);
    expect(name).toHaveLength(20);
    expect(name.endsWith(" (2)")).toBe(true);
  });
});
