import type {
  DriverComfortSettings,
  DriverComfortState,
} from "@/shared/pleos/pleos.types";

import { comfortChanges, isFanManual } from "./bodyfit-comfort";
import { interpretByRules } from "./bodyfit-feedback";
import { comfortSettingsSchema } from "./bodyfit.schema";
import type {
  ComfortSettings,
  FanDirection,
  FeedbackInterpretation,
} from "./bodyfit.types";

// 음성으로 온도 취향을 맞추는 규칙 (E-4). 음성 인식 결과는 신뢰하지 않는 입력이다 (S-4):
// 말은 정해진 요청(ComfortRequest)으로만 바뀌고, 요청은 차량 범위와 한 번에 바뀌는 양 안에서만 값이 된다.
// 만든 조절안은 화면에 보여 주고 운전자가 누른 뒤에만 차량에 보낸다.

type LevelTarget = "seatHeat" | "seatVent" | "steeringHeat";
type StepTarget = LevelTarget | "cabinTarget" | "fanSpeed";
type Amount = "small" | "medium";

export type ComfortRequest =
  /** "열선 켜 줘 / 꺼 줘" */
  | { kind: "power"; target: LevelTarget; on: boolean }
  /** "바람 좀 줄여 줘", "온도 올려 줘" */
  | {
      kind: "step";
      target: StepTarget;
      direction: "increase" | "decrease";
      amount: Amount;
    }
  /** "추워요 / 더워요": 무엇을 바꿀지는 차량이 지원하는 항목을 보고 정한다 */
  | { kind: "feel"; feel: "cold" | "hot"; amount: Amount }
  /** "평소 온도로 맞춰 줘": 출발 기록으로 고른 추천(E-2)을 그대로 쓴다 */
  | { kind: "usual" };

export type VoiceRequest =
  | { kind: "seat"; interpretation: FeedbackInterpretation }
  | { kind: "comfort"; requests: ComfortRequest[] }
  /** 조절안을 만들지 않고 답만 한다 */
  | { kind: "none"; reply: string };

/** 한 번에 바뀌는 양. 열선·통풍은 언제나 1단, 온도는 1~2℃, 풍량은 1~2단이다. */
export const VOICE_COMFORT_STEP = {
  cabinTarget: { small: 1, medium: 2 },
  fanSpeed: { small: 1, medium: 2 },
  level: 1,
} as const;

// 음성 인식이 돌려준 문장이 비정상적으로 길어도 앞부분만 본다.
const MAX_UTTERANCE_LENGTH = 200;

const COMFORT_PATTERN =
  /열선|엉따|통풍|온도|바람|풍량|에어컨|히터|추워|추웠|추운|춥|쌀쌀|썰렁|더워|더웠|더운|덥|시려|시리|차가|차갑|따뜻|시원/;

// 시트 자세 이야기. "올려·내려" 는 열선·온도에도 쓰는 말이라 "시트" 바로 뒤에 열선·통풍이 오지 않을 때만 자세로 본다.
const POSTURE_PATTERN =
  /등받이|페달|다리|무릎|자세|앞으로|뒤로|당겨|밀어|눕혀|눕히|세워|젖혀|젖히|헤드 ?레스트|벨트|좌판|(핸들|운전대)\S* ?(너무 |좀 )?(멀|안 ?닿)|(시트|의자)(?! ?(열선|통풍|히터|온도))[^,.]*?(높|낮|올려|올리|내려|내리)/;

const MIXED_REPLY =
  "시트 자세와 온도는 한 번에 하나씩 맞춰요. 하나만 다시 말해 주세요";
const FAN_DIRECTION_PATTERN = /바람 ?방향|앞유리|성에|김 ?서림|습기/;
const FAN_DIRECTION_REPLY =
  "바람 방향은 말로 바꾸지 않아요. 차량의 공조 버튼으로 맞춰 주세요";
const HVAC_POWER_REPLY =
  "공조를 켜고 끄는 것은 말로 하지 않아요. 차량의 공조 버튼으로 해 주세요";
// "차 안 더워요" 의 "안" 은 부정이 아니다.
const CONTENT_PATTERN =
  /(?<!차 ?)안 ?(추|춥|더|덥)|(춥|덥)지 ?(않|안)|(추|더)운 ?건 ?아니/;
const CONTENT_REPLY = "알겠어요. 지금 온도 그대로 둘게요";
const UNCLEAR_REPLY =
  "어떻게 바꿀지 잘 모르겠어요. '추워요'나 '핸들 열선 켜 줘'처럼 말해 주세요";
const USUAL_PATTERN = /(평소|평상시|원래|늘 ?하던|좋아하는)[^,.]{0,6}온도/;

type Subject = StepTarget | "heater" | "aircon";

// 위에서부터 찾고, 찾은 자리는 지워 아래 규칙이 다시 잡지 않게 한다 ("핸들 열선" 의 "열선" 이 시트 열선으로 읽히지 않게).
const SUBJECTS: { subject: Subject; pattern: RegExp }[] = [
  { subject: "steeringHeat", pattern: /(핸들|운전대|스티어링) ?(열선|히터)/g },
  { subject: "seatHeat", pattern: /(시트|의자|엉덩이) ?(열선|히터|온도)/g },
  { subject: "seatVent", pattern: /통풍/g },
  { subject: "seatHeat", pattern: /열선|엉따/g },
  { subject: "fanSpeed", pattern: /바람|풍량/g },
  { subject: "heater", pattern: /히터/g },
  { subject: "aircon", pattern: /에어컨/g },
  { subject: "cabinTarget", pattern: /온도/g },
];

type Verb = "off" | "down" | "up" | "on";

// "약하게 해 줘" 의 "해 줘" 가 켜기로 읽히지 않게 끄기·줄이기를 먼저 본다.
const VERBS: { verb: Verb; pattern: RegExp }[] = [
  { verb: "off", pattern: /꺼|끄|끌|그만/ },
  {
    verb: "down",
    pattern: /내려|내리|낮춰|낮추|낮게|줄여|줄이|약하게|약한|살살|시원/,
  },
  {
    verb: "up",
    pattern: /올려|올리|높여|높이|높게|세게|강하게|키워|키우|따뜻/,
  },
  { verb: "on", pattern: /켜|틀|작동|해 ?줘|해 ?주/ },
];

const verbOf = (segment: string): Verb | undefined =>
  VERBS.find(({ pattern }) => pattern.test(segment))?.verb;

const COLD_HANDS_PATTERN =
  /(핸들|운전대|손)\S* ?(너무 |좀 |조금 )?(차가|차갑|시려|시리)/;
const COLD_SEAT_PATTERN =
  /(엉덩이|허리|등|시트|의자)\S* ?(너무 |좀 |조금 )?(차가|차갑|시려|시리)/;
const COLD_PATTERN = /추워|추웠|추운|춥|쌀쌀|썰렁|시려|시리|차가|차갑|따뜻/;
const HOT_PATTERN = /더워|더웠|더운|덥|시원/;

/**
 * 말 한 문장을 시트 조절안이나 온도 요청으로 나눈다.
 * 온도 이야기가 없으면(또는 온도를 맞출 수 없는 빌드면) 시트 해석으로 넘긴다.
 * 시트 자세와 온도가 한 문장에 섞이면 어느 쪽도 만들지 않고 하나씩 말해 달라고 한다:
 * 시트는 "끼임 확인" 창을 거쳐 움직이고 온도는 바뀔 값을 보고 맞추므로, 확인을 하나로 뭉치지 않는다.
 */
export function interpretVoiceRequest(
  utterance: string,
  { comfort }: { comfort: boolean },
): VoiceRequest {
  const text = utterance.slice(0, MAX_UTTERANCE_LENGTH).replace(/\s+/g, " ");
  if (!comfort || !COMFORT_PATTERN.test(text)) {
    return { kind: "seat", interpretation: interpretByRules(text) };
  }
  if (POSTURE_PATTERN.test(text)) return { kind: "none", reply: MIXED_REPLY };
  if (FAN_DIRECTION_PATTERN.test(text))
    return { kind: "none", reply: FAN_DIRECTION_REPLY };
  if (CONTENT_PATTERN.test(text)) return { kind: "none", reply: CONTENT_REPLY };
  if (USUAL_PATTERN.test(text))
    return { kind: "comfort", requests: [{ kind: "usual" }] };

  const amount: Amount = /많이|훨씬|확|너무|2 ?도|두 ?도/.test(text)
    ? "medium"
    : "small";

  const { requests, hvacPower } = subjectRequests(text, amount);
  if (requests.length > 0) return { kind: "comfort", requests };
  if (hvacPower) return { kind: "none", reply: HVAC_POWER_REPLY };

  // 무엇을 바꿀지 말하지 않았으면 느낌("추워요")으로 정한다.
  if (COLD_HANDS_PATTERN.test(text))
    return {
      kind: "comfort",
      requests: [{ kind: "power", target: "steeringHeat", on: true }],
    };
  if (COLD_SEAT_PATTERN.test(text))
    return {
      kind: "comfort",
      requests: [{ kind: "power", target: "seatHeat", on: true }],
    };
  const cold = COLD_PATTERN.test(text);
  const hot = HOT_PATTERN.test(text);
  if (cold !== hot)
    return {
      kind: "comfort",
      requests: [{ kind: "feel", feel: cold ? "cold" : "hot", amount }],
    };
  return { kind: "none", reply: UNCLEAR_REPLY };
}

function subjectRequests(
  text: string,
  amount: Amount,
): { requests: ComfortRequest[]; hvacPower: boolean } {
  let rest = text;
  const mentions: { subject: Subject; start: number; end: number }[] = [];
  for (const { subject, pattern } of SUBJECTS) {
    for (const match of rest.matchAll(pattern)) {
      mentions.push({
        subject,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    rest = rest.replace(pattern, (found) => " ".repeat(found.length));
  }
  mentions.sort((a, b) => a.start - b.start);

  // 한국어는 동사가 뒤에 온다: 대상 뒤부터 다음 대상 앞까지에서 동사를 찾고,
  // 없으면 뒤 대상의 동사를 물려받는다 ("시트 열선이랑 핸들 열선 켜 줘").
  const requests: ComfortRequest[] = [];
  const seen = new Set<StepTarget>();
  let hvacPower = false;
  let inherited: Verb | undefined;
  for (let index = mentions.length - 1; index >= 0; index -= 1) {
    const { subject, end } = mentions[index];
    const verb =
      verbOf(rest.slice(end, mentions[index + 1]?.start)) ?? inherited;
    inherited = verb;
    if (!verb) continue;
    const request = toRequest(subject, verb, amount);
    if (request === "hvacPower") hvacPower = true;
    // 같은 항목을 두 번 말하면 뒤의 말만 쓴다 (서로 반대 방향이 섞이지 않게).
    else if (request && !seen.has(request.target)) {
      seen.add(request.target);
      requests.unshift(request);
    }
  }
  return { requests, hvacPower };
}

type SubjectRequest = Extract<ComfortRequest, { target: StepTarget }>;

function toRequest(
  subject: Subject,
  verb: Verb,
  amount: Amount,
): SubjectRequest | "hvacPower" | null {
  const step = (
    target: StepTarget,
    direction: "increase" | "decrease",
  ): SubjectRequest => ({ kind: "step", target, direction, amount });

  switch (subject) {
    case "seatHeat":
    case "seatVent":
    case "steeringHeat":
      return verb === "on" || verb === "off"
        ? { kind: "power", target: subject, on: verb === "on" }
        : step(subject, verb === "up" ? "increase" : "decrease");
    case "fanSpeed":
      // 공조 전원은 이 앱이 다루지 않는다 (풍량 값으로 공조를 켜거나 끄지 않는다).
      return verb === "on" || verb === "off"
        ? "hvacPower"
        : step("fanSpeed", verb === "up" ? "increase" : "decrease");
    case "cabinTarget":
      return verb === "up" || verb === "down"
        ? step("cabinTarget", verb === "up" ? "increase" : "decrease")
        : null;
    // "히터 틀어 줘" 는 더 따뜻하게, "에어컨 틀어 줘" 는 더 시원하게로 읽는다.
    case "heater":
    case "aircon": {
      if (verb === "off") return "hvacPower";
      const stronger = verb !== "down";
      const warmer = subject === "heater" ? stronger : !stronger;
      return step("cabinTarget", warmer ? "increase" : "decrease");
    }
  }
}

// 말로는 온도 항목만 바꾼다. 무드등은 온도 이야기가 아니라 음성 조절안에 넣지 않는다.
type ComfortKey = Exclude<
  keyof ComfortSettings,
  "ambientOn" | "ambientBrightness" | "ambientColor"
>;

export type VoiceComfortItem = {
  key: ComfortKey;
  from: number | FanDirection;
  to: number | FanDirection;
};

export type VoiceComfortPlan = {
  /** 차량에 보낼 값. 비어 있으면 바꿀 것이 없다 */
  changes: DriverComfortSettings;
  /** 화면에 보여 줄 "무엇을 어떻게" */
  items: VoiceComfortItem[];
  /** 운전자에게 보여 주고 들려줄 해요체 문장 */
  reply: string;
};

// 을/를·은/는 은 이름마다 정해 둔다 (받침 계산을 하지 않는다).
const LABELS: Record<
  ComfortKey,
  { name: string; object: string; topic: string }
> = {
  seatHeat: { name: "시트 열선", object: "시트 열선을", topic: "시트 열선은" },
  seatVent: { name: "시트 통풍", object: "시트 통풍을", topic: "시트 통풍은" },
  steeringHeat: {
    name: "핸들 열선",
    object: "핸들 열선을",
    topic: "핸들 열선은",
  },
  cabinTarget: {
    name: "실내 온도",
    object: "실내 온도를",
    topic: "실내 온도는",
  },
  fanSpeed: { name: "풍량", object: "풍량을", topic: "풍량은" },
  fanDirection: {
    name: "바람 방향",
    object: "바람 방향을",
    topic: "바람 방향은",
  },
  mirrorHeat: {
    name: "사이드미러 열선",
    object: "사이드미러 열선을",
    topic: "사이드미러 열선은",
  },
};

const FAN_DIRECTION_COPY: Record<FanDirection, string> = {
  face: "얼굴",
  floor: "발",
  faceFloor: "얼굴과 발",
  defrost: "앞유리",
  faceDefrost: "얼굴과 앞유리",
  floorDefrost: "발과 앞유리",
  faceFloorDefrost: "얼굴·발·앞유리",
};

export const comfortItemLabel = (key: ComfortKey): string => LABELS[key].name;

const degrees = (value: number) => Number(value.toFixed(1));

/** 화면에 보여 줄 값. 예: "꺼짐", "켬", "2단", "23℃", "얼굴과 발" */
export function describeComfortValue(
  key: ComfortKey,
  value: number | FanDirection,
  state: DriverComfortState,
): string {
  if (typeof value === "string") return FAN_DIRECTION_COPY[value];
  if (key === "cabinTarget") return `${degrees(value)}℃`;
  if (value === 0) return "꺼짐";
  if (value < 0) return `냉각 ${-value}단`;
  const max = key === "fanDirection" ? undefined : state[key]?.max;
  return max === 1 ? "켬" : `${value}단`;
}

const ENDINGS = {
  on: ["켜고", "켤게요"],
  off: ["끄고", "끌게요"],
  raise: ["올리고", "올릴게요"],
  lower: ["내리고", "내릴게요"],
  change: ["바꾸고", "바꿀게요"],
} as const;

function describeItem(
  { key, from, to }: VoiceComfortItem,
  state: DriverComfortState,
  last: boolean,
): string {
  const { object } = LABELS[key];
  const end = (verb: keyof typeof ENDINGS) => ENDINGS[verb][last ? 1 : 0];
  if (typeof to === "string" || typeof from === "string")
    return `${object} ${typeof to === "string" ? FAN_DIRECTION_COPY[to] : to} 쪽으로 ${end("change")}`;
  if (key === "cabinTarget")
    return `${object} ${degrees(to)}도로 ${end(to > from ? "raise" : "lower")}`;
  if (to === 0) return `${object} ${end("off")}`;
  if (to < 0) return `${object} 냉각 ${-to}단으로 ${end("change")}`;
  const single = key !== "fanDirection" && state[key]?.max === 1;
  if (from <= 0) return `${object} ${single ? "" : `${to}단으로 `}${end("on")}`;
  return `${object} ${to}단으로 ${end(to > from ? "raise" : "lower")}`;
}

const NO_RECORDS_REPLY =
  "아직 온도 기록이 없어요. 출발할 때의 설정부터 기억할게요";
const SAME_AS_USUAL_REPLY = "지금 설정이 평소 온도와 같아요";
const NOTHING_SUPPORTED_REPLY = "이 차에서는 온도를 바꿀 수 없어요";

/**
 * 온도 요청을 지금 차량 상태에 맞춘 조절안으로 바꾼다.
 * - 차량이 지원하지 않는 항목은 바꾸지 않고 "이 차에서는 바꿀 수 없어요"로 답한다.
 * - 값은 차량이 알려 준 범위 안으로 자르고, 한 번에 VOICE_COMFORT_STEP 만큼만 바꾼다. 끄기는 바로 0 으로 간다.
 * - 말로는 열선을 냉각(음수) 쪽으로 보내지 않는다.
 * - 풍량은 운전자가 직접 정하고 있을 때만 바꾼다 (자동 공조를 풀거나 꺼진 공조를 켜지 않는다).
 * - "평소 온도"는 기록으로 고른 추천을 그대로 쓴다 (카드의 "평소 온도로 맞추기"와 같은 값).
 * 마지막에 차량에 보낼 값을 zod 로 다시 검증하고, 어긋나면 아무것도 바꾸지 않는다.
 */
export function planVoiceComfort(
  requests: readonly ComfortRequest[],
  state: DriverComfortState,
  usual: ComfortSettings | null,
): VoiceComfortPlan {
  const wanted: Partial<Record<StepTarget, number>> = {};
  const notes: string[] = [];
  const note = (text: string) => {
    if (!notes.includes(text)) notes.push(text);
  };
  let usualChanges: DriverComfortSettings | null = null;

  const set = (key: StepTarget, value: number): boolean => {
    const item = state[key];
    if (!item) return false;
    const floor =
      key === "cabinTarget" || key === "fanSpeed"
        ? item.min
        : Math.max(item.min, Math.min(0, item.value));
    const unit = key === "cabinTarget" ? 0.5 : 1;
    const clamped = Math.min(
      item.max,
      Math.max(floor, Math.round(value / unit) * unit),
    );
    if (Math.abs(clamped - item.value) <= 0.01) return false;
    wanted[key] = clamped;
    return true;
  };

  const unsupported = (key: StepTarget) =>
    note(`${LABELS[key].topic} 이 차에서는 바꿀 수 없어요`);

  // 열선과 통풍은 함께 켜지 않는다 (추천과 같은 규칙). 한쪽을 켜면 켜져 있던 다른 쪽을 끈다.
  const turnOffOpposite = (key: StepTarget) => {
    const opposite =
      key === "seatHeat" ? "seatVent" : key === "seatVent" ? "seatHeat" : null;
    if (opposite && (state[opposite]?.value ?? 0) > 0) set(opposite, 0);
  };

  const step = (
    key: StepTarget,
    direction: "increase" | "decrease",
    amount: Amount,
  ) => {
    const item = state[key];
    if (!item) return unsupported(key);
    if (key === "fanSpeed" && !isFanManual(state))
      return note(
        state.fanMode === "auto"
          ? "자동 공조 중이라 풍량은 그대로 둘게요"
          : "공조가 꺼져 있어 풍량은 그대로 둘게요",
      );
    const size =
      key === "cabinTarget" || key === "fanSpeed"
        ? VOICE_COMFORT_STEP[key][amount]
        : VOICE_COMFORT_STEP.level;
    const up = direction === "increase";
    if (!set(key, item.value + (up ? size : -size)))
      return note(`${LABELS[key].topic} 이미 가장 ${up ? "높아요" : "낮아요"}`);
    if (up && item.value <= 0) turnOffOpposite(key);
  };

  for (const request of requests) {
    switch (request.kind) {
      case "usual":
        if (!usual) note(NO_RECORDS_REPLY);
        else {
          // 화면에 보여 주는 항목만 바꾼다 (무드등은 "평소 온도"에 넣지 않는다).
          const all = comfortChanges(state, usual);
          usualChanges = {};
          for (const key of Object.keys(LABELS) as ComfortKey[]) {
            const value = all[key];
            if (value !== undefined)
              (usualChanges as Record<string, unknown>)[key] = value;
          }
          if (Object.keys(usualChanges).length === 0) note(SAME_AS_USUAL_REPLY);
        }
        break;
      case "power": {
        const item = state[request.target];
        if (!item) unsupported(request.target);
        else if (request.on) {
          if (item.value > 0 || !set(request.target, VOICE_COMFORT_STEP.level))
            note(`${LABELS[request.target].topic} 이미 켜져 있어요`);
          else turnOffOpposite(request.target);
        } else if (!set(request.target, 0))
          note(`${LABELS[request.target].topic} 이미 꺼져 있어요`);
        break;
      }
      case "step":
        step(request.target, request.direction, request.amount);
        break;
      case "feel": {
        // 추우면 온도를 올리고, 온도를 못 바꾸는 차는 시트 열선을 올린다. 더우면 온도를 내리거나 통풍을 올린다.
        const cold = request.feel === "cold";
        const fallback = cold ? "seatHeat" : "seatVent";
        const key = state.cabinTarget
          ? "cabinTarget"
          : state[fallback]
            ? fallback
            : null;
        if (!key) note(NOTHING_SUPPORTED_REPLY);
        else
          step(
            key,
            key === "cabinTarget" && !cold ? "decrease" : "increase",
            request.amount,
          );
        break;
      }
    }
  }

  const changes: DriverComfortSettings = { ...usualChanges, ...wanted };
  const parsed = comfortSettingsSchema.safeParse(changes);
  if (!parsed.success) return { changes: {}, items: [], reply: UNCLEAR_REPLY };

  const items: VoiceComfortItem[] = [];
  for (const key of Object.keys(LABELS) as ComfortKey[]) {
    const to = changes[key];
    const from = state[key]?.value;
    if (to !== undefined && from !== undefined) items.push({ key, from, to });
  }

  // 평소 온도는 여러 항목이 한꺼번에 바뀌므로 문장으로 다 읽지 않고 화면의 목록으로 보여 준다.
  const summary =
    items.length === 0
      ? []
      : usualChanges && Object.keys(usualChanges).length > 0
        ? ["평소 좋아하시는 온도로 맞출게요"]
        : [
            items
              .map((item, index) =>
                describeItem(item, state, index === items.length - 1),
              )
              .join(", "),
          ];
  const sentences = [...summary, ...notes];
  return {
    changes,
    items,
    reply: sentences.length > 0 ? sentences.join(". ") : UNCLEAR_REPLY,
  };
}
