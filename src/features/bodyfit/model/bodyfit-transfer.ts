import { z } from "zod";

import { DRIVE_CONTEXTS } from "./bodyfit-drive-context";
import {
  CONTEXT_FULL_RECORDS,
  MAX_OFFSET,
  MAX_RECORDS,
  summarizeContext,
} from "./bodyfit-learning";
import {
  recommendBaseline,
  type BaselineAxis,
  type LearnedOnlyAxis,
} from "./bodyfit-recommend";
import { clamp } from "./bodyfit-seat";
import { NAME_MAX_LENGTH, bodyProfileInputSchema } from "./bodyfit.schema";
import type {
  BodyProfile,
  DriveContext,
  SeatAdjustment,
  SeatRatios,
} from "./bodyfit.types";

/*
 * 다른 차로 내 자세 가져가기 (A-7).
 * 추천은 차종별 시트 좌표가 아니라 체형 + 개인 보정(비율 차이)으로 계산하므로, 그 둘만 QR 에 담아 옮기면
 * 다른 차에서도 그 차의 시트 범위로 다시 계산할 수 있다. 서버를 거치지 않는다.
 * 읽어 온 QR 내용은 신뢰하지 않는 입력이다: 크기 → 형식 → 버전 → 범위 순으로 검증하고, 하나라도 어긋나면 저장하지 않는다.
 */

export const TRANSFER_KIND = "bodyfit";
/** 형식이 바뀌면 올린다 (축 순서·단위 포함). 다른 버전의 코드는 읽지 않는다. */
export const TRANSFER_VERSION = 1;
/** QR 에서 읽은 글자 수 한계. 가장 큰 정상 코드(이름 20자, 상황 4개, 축 9개)도 이 안에 들어온다 (테스트로 확인). */
export const MAX_TRANSFER_TEXT_LENGTH = 600;

// 코드 안의 축 순서. 형식의 일부라 SEAT_AXES 의 순서가 바뀌어도 따라가지 않는다 (바꾸면 TRANSFER_VERSION 을 올린다).
export const TRANSFER_OFFSET_AXES = [
  "foreAft",
  "height",
  "backrest",
  "tilt",
  "depth",
  "headrestHeight",
  "beltHeight",
] as const satisfies readonly BaselineAxis[];
export const TRANSFER_REMEMBERED_AXES = [
  "lumbar",
  "headrestAngle",
] as const satisfies readonly LearnedOnlyAxis[];

/** 한 상황의 학습 요약. 차량 원시 값이 아니라 비율이라 차종에 묶이지 않는다. */
export type TransferLearning = {
  context: DriveContext;
  /** 이 요약에 반영된 기록 수 (1 ~ MAX_RECORDS) */
  count: number;
  /** 체형 기반 추천 대비 축별 보정 (± MAX_OFFSET). 기록이 없는 축은 없다 */
  offsets: SeatRatios;
  /** 기본 추천이 없는 축에서 평소 두던 위치 (0~1) */
  remembered: SeatRatios;
};

/** QR 에 담는 내용 전부: 체형 값과 학습 요약. 동의 여부·시각·기록 원본은 담지 않는다. */
export type PostureTransfer = {
  name: string;
  heightCm: number;
  weightKg: number;
  sittingHeightCm: number | null;
  /** 최근에 쓴 상황이 앞에 온다 */
  learning: TransferLearning[];
};

/** 이 차에서 쌓인 프로필·기록을 내보낼 내용으로 줄인다. 기록이 있는 상황만 담는다. */
export function buildTransfer(
  profile: BodyProfile,
  history: readonly SeatAdjustment[],
): PostureTransfer {
  const latest = (context: DriveContext) =>
    Math.max(
      ...history
        .filter((record) => record.context === context)
        .map((record) => record.at),
    );
  const learning = DRIVE_CONTEXTS.map((context) => ({
    context,
    ...summarizeContext(history, context),
  }))
    .filter((item) => item.count > 0)
    .sort((a, b) => latest(b.context) - latest(a.context));

  return {
    name: profile.name,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    sittingHeightCm: profile.sittingHeightCm,
    learning,
  };
}

// 비율은 천분율 정수로 적는다 (0.001 = 시트 범위의 0.1%, 가이드 허용 오차보다 훨씬 작다). 코드가 짧아져 QR 이 성겨진다.
const PER_MILLE = 1000;
const toPerMille = (value: number | undefined): number | null =>
  value === undefined ? null : Math.round(value * PER_MILLE) || 0;

// 한글 이름을 \uXXXX 로 적어 코드를 ASCII 로만 만든다. QR 은 글자 인코딩을 따로 알려 주지 않아
// 읽는 쪽이 UTF-8 을 다르게 추측하면 이름이 깨진다. JSON.parse 가 그대로 되돌린다.
const toAscii = (json: string) =>
  json.replace(
    /[\u0080-￿]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );

const PREFIX = `{"k":"${TRANSFER_KIND}",`;

/** 내보낼 내용 → QR 에 넣을 글자. 종류(k)와 버전(v)이 맨 앞에 온다. */
export function encodeTransfer(transfer: PostureTransfer): string {
  return toAscii(
    JSON.stringify({
      k: TRANSFER_KIND,
      v: TRANSFER_VERSION,
      n: transfer.name,
      h: transfer.heightCm,
      w: transfer.weightKg,
      s: transfer.sittingHeightCm,
      l: transfer.learning.map((item) => [
        item.context,
        item.count,
        TRANSFER_OFFSET_AXES.map((axis) => toPerMille(item.offsets[axis])),
        TRANSFER_REMEMBERED_AXES.map((axis) =>
          toPerMille(item.remembered[axis]),
        ),
      ]),
    }),
  );
}

const offsetPerMille = z
  .int()
  .min(-MAX_OFFSET * PER_MILLE)
  .max(MAX_OFFSET * PER_MILLE)
  .nullable();
const ratioPerMille = z.int().min(0).max(PER_MILLE).nullable();

// 이름은 화면에 그대로 보인다. 줄바꿈 같은 제어 문자가 섞인 이름은 받지 않는다.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

// 모르는 필드가 있으면 거부한다 (strict). 체형 값의 범위는 직접 등록할 때와 같다.
const wireSchema = z.strictObject({
  k: z.literal(TRANSFER_KIND),
  v: z.literal(TRANSFER_VERSION),
  n: bodyProfileInputSchema.shape.name.refine(
    (name) => !CONTROL_CHARS.test(name),
  ),
  h: bodyProfileInputSchema.shape.heightCm,
  w: bodyProfileInputSchema.shape.weightKg,
  s: bodyProfileInputSchema.shape.sittingHeightCm,
  l: z
    .array(
      z.tuple([
        z.enum(DRIVE_CONTEXTS),
        z.int().min(1).max(MAX_RECORDS),
        z.array(offsetPerMille).length(TRANSFER_OFFSET_AXES.length),
        z.array(ratioPerMille).length(TRANSFER_REMEMBERED_AXES.length),
      ]),
    )
    .max(DRIVE_CONTEXTS.length),
});

/**
 * 가져오지 못한 이유.
 * tooLarge: 코드가 너무 크다, notBodyfit: BodyFit 코드가 아니다, version: 다른 버전의 코드다,
 * malformed: 형식이 깨졌다, outOfRange: 값이 허용 범위를 벗어났다 (키·몸무게·보정 한계 등).
 */
export type TransferFailure =
  "tooLarge" | "notBodyfit" | "version" | "malformed" | "outOfRange";

export type TransferDecodeResult =
  | { ok: true; transfer: PostureTransfer }
  | { ok: false; reason: TransferFailure };

const fail = (reason: TransferFailure): TransferDecodeResult => ({
  ok: false,
  reason,
});

const fromPerMille = (
  axes: readonly (BaselineAxis | LearnedOnlyAxis)[],
  values: readonly (number | null)[],
): SeatRatios => {
  const ratios: SeatRatios = {};
  axes.forEach((axis, index) => {
    const value = values[index];
    if (value !== null && value !== undefined) {
      ratios[axis] = value / PER_MILLE;
    }
  });
  return ratios;
};

/**
 * QR 에서 읽은 글자 → 가져올 내용. 검증을 모두 통과해야 ok 다.
 * 범위를 벗어난 값을 잘라서 받지 않는다: 정상 코드는 범위를 넘지 않으므로 넘었다면 깨졌거나 만들어 낸 코드다.
 * 이 함수는 아무것도 저장하지 않고 시트도 움직이지 않는다 (운전자가 미리보기를 확인한 뒤에 저장한다).
 */
export function decodeTransfer(text: unknown): TransferDecodeResult {
  if (typeof text !== "string") return fail("malformed");
  // JSON 으로 읽기 전에 크기부터 본다.
  if (text.length > MAX_TRANSFER_TEXT_LENGTH) return fail("tooLarge");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // 우리 코드로 시작하는데 읽히지 않으면 잘린 코드다. 아니면 다른 용도의 QR 이다.
    return fail(text.startsWith(PREFIX) ? "malformed" : "notBodyfit");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return fail("notBodyfit");
  }
  const envelope = raw as { k?: unknown; v?: unknown };
  if (envelope.k !== TRANSFER_KIND) return fail("notBodyfit");
  if (envelope.v !== TRANSFER_VERSION) {
    return fail(typeof envelope.v === "number" ? "version" : "malformed");
  }

  const parsed = wireSchema.safeParse(raw);
  if (!parsed.success) {
    const onlyRange = parsed.error.issues.every(
      (issue) =>
        (issue.code === "too_big" || issue.code === "too_small") &&
        (issue.origin === "number" || issue.origin === "int"),
    );
    return fail(onlyRange ? "outOfRange" : "malformed");
  }

  const { n, h, w, s, l } = parsed.data;
  const contexts = l.map(([context]) => context);
  if (new Set(contexts).size !== contexts.length) return fail("malformed");

  return {
    ok: true,
    transfer: {
      name: n,
      heightCm: h,
      weightKg: w,
      sittingHeightCm: s,
      learning: l.map(([context, count, offsets, remembered]) => ({
        context,
        count,
        offsets: fromPerMille(TRANSFER_OFFSET_AXES, offsets),
        remembered: fromPerMille(TRANSFER_REMEMBERED_AXES, remembered),
      })),
    },
  };
}

/** 미리보기에 보여 줄 "학습 기록 ○건" */
export const transferRecordCount = (transfer: PostureTransfer): number =>
  transfer.learning.reduce((sum, item) => sum + item.count, 0);

/**
 * 가져온 학습 요약을 이 차의 자세 기록 모양으로 되살린다. 그러면 기존 학습(C-2, C-5)이 그대로 읽고,
 * 이 차에서 새 기록이 쌓일수록 가져온 보정은 저절로 옅어진다 (최근 기록을 더 크게 반영하므로).
 *
 * 상황마다 (기록 수, 최대 CONTEXT_FULL_RECORDS 건)만큼 같은 기록을 만든다: 원래 차에서 그 상황의 기록이
 * 추천에 반영되던 정도(기록 수 ÷ CONTEXT_FULL_RECORDS)를 그대로 잇기 위해서다.
 * baseline 은 이 운전자의 체형 기반 추천, final 은 거기에 보정을 더한 값(0~1 로 자름)이다.
 * 실제로 앉았던 자세가 아니므로 출처를 imported 로 남긴다.
 */
export function toImportedAdjustments(
  transfer: PostureTransfer,
  profile: BodyProfile,
  now: number,
): SeatAdjustment[] {
  const baseline = recommendBaseline(profile);
  const records: SeatAdjustment[] = [];
  // 앞에 온 상황(최근에 쓴 상황)의 기록이 더 최근이 되게 시각을 1ms 씩 물린다.
  let at = now;

  for (const item of transfer.learning) {
    const final: SeatRatios = {};
    for (const axis of TRANSFER_OFFSET_AXES) {
      const offset = item.offsets[axis];
      if (offset === undefined) continue;
      final[axis] = clamp(
        baseline[axis] + clamp(offset, -MAX_OFFSET, MAX_OFFSET),
        0,
        1,
      );
    }
    for (const axis of TRANSFER_REMEMBERED_AXES) {
      const kept = item.remembered[axis];
      if (kept !== undefined) final[axis] = clamp(kept, 0, 1);
    }
    if (Object.keys(final).length === 0) continue;

    const copies = Math.min(item.count, CONTEXT_FULL_RECORDS);
    for (let copy = 0; copy < copies; copy += 1) {
      records.push({
        profileId: profile.id,
        at,
        baseline,
        final,
        source: "imported",
        context: item.context,
      });
      at -= 1;
    }
  }
  return records;
}

/**
 * 가져온 이름이 이미 있는 운전자와 같으면 덮어쓰지 않고 번호를 붙여 새로 등록한다 ("홍길동 (2)").
 * 같은 사람인지 앱이 알 수 없고, 덮어쓰면 이 차에서 쌓은 기록이 사라지기 때문이다.
 */
export function resolveImportName(
  name: string,
  existingNames: readonly string[],
): { name: string; renamed: boolean } {
  const taken = new Set(existingNames.map((existing) => existing.trim()));
  const wanted = name.trim();
  if (!taken.has(wanted)) return { name: wanted, renamed: false };

  for (let number = 2; ; number += 1) {
    const suffix = ` (${number})`;
    const candidate =
      wanted.slice(0, NAME_MAX_LENGTH - suffix.length).trimEnd() + suffix;
    if (!taken.has(candidate)) return { name: candidate, renamed: true };
  }
}

/**
 * 시연용 샘플 코드 (contest 빌드). 에뮬레이터의 모의 카메라는 고정 사진만 내보내 QR 을 비출 수 없어서,
 * 사람의 실제 값이 아닌 예시 값으로 "읽기 → 미리보기 → 확인" 흐름을 보여 준다. 카메라로 읽은 코드와 같은 검증을 거친다.
 */
export const SAMPLE_TRANSFER: PostureTransfer = {
  name: "샘플 운전자",
  heightCm: 172,
  weightKg: 68,
  sittingHeightCm: 91,
  learning: [
    {
      context: "usual",
      count: 5,
      offsets: { foreAft: -0.04, height: 0.03, backrest: 0.06 },
      remembered: { lumbar: 0.6 },
    },
    {
      context: "long",
      count: 2,
      offsets: { backrest: -0.08 },
      remembered: {},
    },
  ],
};

export const SAMPLE_TRANSFER_CODE = encodeTransfer(SAMPLE_TRANSFER);
