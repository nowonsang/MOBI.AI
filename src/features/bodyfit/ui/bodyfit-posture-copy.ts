import {
  DEFAULT_DRIVE_CONTEXT,
  DRIVE_CONTEXT_LABEL,
} from "../model/bodyfit-drive-context";
import type {
  PostureChange,
  PostureComparison,
  PostureReport,
} from "../model/bodyfit-posture";
import type { DriveContext, SeatNudge } from "../model/bodyfit.types";
import { AXIS_COPY } from "./bodyfit-axis-copy";

// 주행 자세 화면의 문구를 한 곳에 둔다 (같은 대상은 어디서나 같은 말로 부른다).

/** 예시 기록임을 알리는 표시. 카메라 관찰이 연결되기 전까지 화면마다 붙인다 */
export const POSTURE_SAMPLE_NOTICE =
  "예시 기록이에요. 주행 중 카메라 관찰은 아직 연결되지 않았어요";

/** 112 → "1시간 52분", 50 → "50분", 120 → "2시간" */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

/** "다음 장거리 때는", 평소면 "다음에는" */
export function nextDrivePhrase(context: DriveContext): string {
  return context === DEFAULT_DRIVE_CONTEXT
    ? "다음에는"
    : `다음 ${DRIVE_CONTEXT_LABEL[context]} 때는`;
}

/** "지난 장거리", 평소면 "지난 주행" */
export function lastDrivePhrase(context: DriveContext): string {
  return context === DEFAULT_DRIVE_CONTEXT
    ? "지난 주행"
    : `지난 ${DRIVE_CONTEXT_LABEL[context]}`;
}

/** "이번 장거리", 평소면 "이번 주행" */
export function thisDrivePhrase(context: DriveContext): string {
  return context === DEFAULT_DRIVE_CONTEXT
    ? "이번 주행"
    : `이번 ${DRIVE_CONTEXT_LABEL[context]}`;
}

/** 리포트의 한 줄 요약 */
export function postureHeadline(report: PostureReport): string {
  return report.driftStartMin === null
    ? "끝까지 출발 자세를 유지했어요"
    : `${formatMinutes(report.driftStartMin)}쯤부터 자세가 앞으로 쏠렸어요`;
}

type ChangeTile = {
  key: keyof PostureChange;
  label: string;
  value: string;
  /** 달라진 값인지 (달라지지 않은 값은 옅게 쓴다) */
  changed: boolean;
};

const signed = (
  amount: number,
  unit: string,
  positive: string,
  negative: string,
): { value: string; changed: boolean } =>
  amount === 0
    ? { value: "변화 없음", changed: false }
    : {
        value: `${Math.abs(amount)}${unit} ${amount > 0 ? positive : negative}`,
        changed: true,
      };

/** 출발 자세와 달라진 세 가지 (머리 위치, 어깨, 등 기댄 각도) */
export function postureChangeTiles(change: PostureChange): ChangeTile[] {
  return [
    {
      key: "headForwardCm",
      label: "머리 위치",
      ...signed(change.headForwardCm, "cm", "앞으로", "뒤로"),
    },
    {
      key: "shoulderDropCm",
      label: "어깨",
      ...signed(change.shoulderDropCm, "cm", "내려감", "올라감"),
    },
    {
      key: "backLeanDeg",
      label: "등 기댄 각도",
      ...signed(change.backLeanDeg, "°", "숙임", "더 기댐"),
    },
  ];
}

/** 견준 문장의 앞부분: "지난 장거리보다", 같으면 "지난 장거리 때만큼" */
export function comparisonLead(comparison: PostureComparison): string {
  const last = lastDrivePhrase(comparison.context);
  return comparison.heldDeltaMin === 0 ? `${last} 때만큼` : `${last}보다`;
}

/** 견준 문장의 끝: "35분 더 유지했어요" (좁은 자리에 쓰는 짧은 말) */
export function comparisonShort(comparison: PostureComparison): string {
  const delta = comparison.heldDeltaMin;
  if (delta === 0) return "유지했어요";
  return delta > 0
    ? `${formatMinutes(delta)} 더 유지했어요`
    : `${formatMinutes(-delta)} 덜 유지했어요`;
}

/** 견준 문장의 뒷부분: "출발 자세를 35분 더 유지했어요" (comparisonLead 뒤에 붙는다) */
export function comparisonHeadline(comparison: PostureComparison): string {
  return `출발 자세를 ${comparisonShort(comparison)}`;
}

/** "11월 6일 장거리", 평소면 "11월 6일 주행" (지난 기록을 따로 열었을 때의 이름) */
export function datedDrivePhrase(
  startedAt: number,
  context: DriveContext,
): string {
  const date = new Date(startedAt);
  const kind =
    context === DEFAULT_DRIVE_CONTEXT ? "주행" : DRIVE_CONTEXT_LABEL[context];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${kind}`;
}

// 축 이름 뒤에 붙는 말. 시트를 어느 쪽으로 조금 바꾸자는 제안인지 한마디로 쓴다.
const NUDGE_VERB: Partial<
  Record<SeatNudge["axis"], Record<SeatNudge["direction"], string>>
> = {
  backrest: { increase: "세워", decrease: "눕혀" },
  foreAft: { increase: "앞으로 당겨", decrease: "뒤로 밀어" },
  height: { increase: "올려", decrease: "내려" },
};

/** 제안 한 줄: "등받이를 조금 세워 볼까요?" */
export function nudgeQuestion(nudge: SeatNudge): string {
  const verb = NUDGE_VERB[nudge.axis]?.[nudge.direction] ?? "바꿔";
  return `${AXIS_COPY[nudge.axis].label}를 조금 ${verb} 볼까요?`;
}

/** 반영한 뒤의 한 줄: "다음 장거리 때는 등받이를 조금 세워서 추천해요" */
export function nudgeApplied(nudge: SeatNudge, context: DriveContext): string {
  const verb = NUDGE_VERB[nudge.axis]?.[nudge.direction] ?? "바꿔";
  return `${nextDrivePhrase(context)} ${AXIS_COPY[nudge.axis].label}를 조금 ${verb}서 추천해요`;
}
