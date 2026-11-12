import type {
  FeedbackInterpretation,
  SeatAxis,
  SeatNudge,
} from "./bodyfit.types";

type Rule = { pattern: RegExp; axis: SeatAxis; direction: SeatNudge["direction"] };

// 앱 안 음성 인식(STT) 결과의 해석. 방향이 분명한 표현만 다룬다.
// 자유로운 문장 이해는 차량 음성 AI(Gleo)가 맡고, 그 결과는 bodyfit-gleo.ts 로 들어온다.
const BACKREST_RULES: Rule[] = [
  { pattern: /(세워|일으켜|똑바로|앞으로)/, axis: "backrest", direction: "increase" },
  { pattern: /(눕혀|눕히|젖혀|젖히|뒤로)/, axis: "backrest", direction: "decrease" },
];

const SEAT_RULES: Rule[] = [
  { pattern: /(페달|핸들|운전대).*(멀|안 ?닿)/, axis: "foreAft", direction: "increase" },
  { pattern: /(다리|무릎).*(끼|닿|답답|좁)/, axis: "foreAft", direction: "decrease" },
  { pattern: /(앞으로|당겨)/, axis: "foreAft", direction: "increase" },
  { pattern: /(뒤로|밀어)/, axis: "foreAft", direction: "decrease" },
  { pattern: /(높여|높게|올려|올리)/, axis: "height", direction: "increase" },
  { pattern: /(낮춰|낮게|내려|내리)/, axis: "height", direction: "decrease" },
  { pattern: /(눕혀|젖혀)/, axis: "backrest", direction: "decrease" },
];

export function interpretByRules(utterance: string): FeedbackInterpretation {
  const text = utterance.replace(/\s+/g, " ");
  const amount: SeatNudge["amount"] = /(많이|훨씬|확)/.test(text)
    ? "medium"
    : "small";
  // "등받이를 뒤로" 의 "뒤로" 가 시트 앞뒤 이동으로 읽히지 않게 등받이 언급은 따로 해석한다.
  const rules = /등받이/.test(text) ? BACKREST_RULES : SEAT_RULES;
  const nudges = dedupeByAxis(
    rules
      .filter((rule) => rule.pattern.test(text))
      .map(({ axis, direction }) => ({ axis, direction, amount })),
  );
  if (nudges.length > 0) {
    return { nudges, reply: describeNudges(nudges) };
  }
  return {
    nudges,
    reply: SATISFIED_PATTERN.test(text) ? SATISFIED_REPLY : UNCLEAR_REPLY,
  };
}

const SATISFIED_PATTERN = /(괜찮|좋았|좋아|편했|편해|편안|없어|없었)/;
const SATISFIED_REPLY = "알겠어요. 다음에도 지금 자세로 맞출게요";
const UNCLEAR_REPLY =
  "어떻게 바꿀지 잘 모르겠어요. '시트를 조금 앞으로'처럼 말해 주세요";

const PHRASES: Record<
  SeatAxis,
  { object: string; increase: string; decrease: string }
> = {
  foreAft: { object: "시트를", increase: "앞으로 옮겨", decrease: "뒤로 옮겨" },
  height: { object: "시트를", increase: "높여", decrease: "낮춰" },
  backrest: { object: "등받이를", increase: "세워", decrease: "눕혀" },
  tilt: { object: "좌판 앞쪽을", increase: "올려", decrease: "내려" },
  // 아래 세 축은 음성 해석 규칙이 없다 (말로 바꾸지 않는다). 조절안을 읽어 주는 문구만 갖춘다.
  depth: { object: "좌판을", increase: "늘려", decrease: "줄여" },
  headrestHeight: { object: "헤드레스트를", increase: "높여", decrease: "낮춰" },
  beltHeight: { object: "안전벨트를", increase: "높여", decrease: "낮춰" },
};

/** 예: "시트를 조금 앞으로 옮겨 보고, 등받이를 세워 볼게요" */
export function describeNudges(nudges: readonly SeatNudge[]): string {
  return nudges
    .map(({ axis, direction, amount }, index) => {
      const phrase = PHRASES[axis];
      const verb = `${amount === "small" ? "조금 " : ""}${phrase[direction]}`;
      const ending = index === nudges.length - 1 ? "볼게요" : "보고,";
      return `${phrase.object} ${verb} ${ending}`;
    })
    .join(" ");
}

// 같은 축에 대한 조절이 여러 개면 첫 번째만 쓴다 (서로 반대 방향이 섞이는 것을 막는다).
function dedupeByAxis(nudges: readonly SeatNudge[]): SeatNudge[] {
  const seen = new Set<SeatAxis>();
  return nudges.filter(({ axis }) => {
    if (seen.has(axis)) return false;
    seen.add(axis);
    return true;
  });
}
