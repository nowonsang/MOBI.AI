import { z } from "zod";

export type VoiceAnswer = "yes" | "no" | "unclear";

/** "네", "아니요" 같은 짧은 대답만 본다. 이보다 긴 말은 앞부분만 읽는다 */
const MAX_ANSWER_LENGTH = 40;

const utteranceSchema = z.string().max(1000);

// 부정을 먼저 본다: "아니 맞아"처럼 섞이면 넘어가지 않는 쪽(안전한 쪽)을 택한다.
const NO = /(아니|아뇨|아녜|다른 ?사람|틀렸|틀려|틀린|노노|싫어|안 ?맞)/;
const YES =
  /^(응+|웅+|어+|네+|넵|넹|예|ㅇㅇ|그래|그럼|오케이|좋아)(요)?$|^(응|웅|어|네|예|그래)\s|맞(아|아요|습니다|지|네)/;

/**
 * "○○님이시죠?" 에 대한 대답을 읽는다. 음성 인식 결과는 믿지 않는 입력이라 검증하고 길이를 자른다.
 * 확실한 긍정만 yes 다. 애매하면 unclear: 화면은 아무것도 바꾸지 않고 기다린다.
 */
export function interpretYesNo(utterance: unknown): VoiceAnswer {
  const parsed = utteranceSchema.safeParse(utterance);
  if (!parsed.success) return "unclear";
  const text = parsed.data
    .slice(0, MAX_ANSWER_LENGTH)
    .replace(/[.,!?~…]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!text) return "unclear";
  if (NO.test(text) || /^(no|nope)\b/.test(text)) return "no";
  if (YES.test(text) || /^(yes|yeah|ok|okay)\b/.test(text)) return "yes";
  return "unclear";
}
