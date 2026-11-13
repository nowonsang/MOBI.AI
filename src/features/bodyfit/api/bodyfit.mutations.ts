import { useMutation, useQueryClient } from "@tanstack/react-query";

import { canControlComfort } from "@/shared/config/app-variant";
import { pleos } from "@/shared/pleos/pleos";

import {
  planAutoAdjust,
  type AutoAdjustStep,
} from "../model/bodyfit-auto-adjust";
import { recommendComfort, toComfortRecord } from "../model/bodyfit-comfort";
import { interpretByRules } from "../model/bodyfit-feedback";
import { interpretYesNo } from "../model/bodyfit-voice-answer";
import type { PostureDrive } from "../model/bodyfit-posture";
import {
  demoCameraSamples,
  toPostureDrive,
} from "../model/bodyfit-posture-camera";
import { recommendBaseline } from "../model/bodyfit-recommend";
import {
  interpretVoiceRequest,
  planVoiceComfort,
  type VoiceComfortPlan,
} from "../model/bodyfit-voice-comfort";
import {
  applyNudges,
  toSeatRatios,
  toSeatTargets,
} from "../model/bodyfit-seat";
import type {
  BodyProfile,
  BodyProfileInput,
  ComfortSettings,
  DriveContext,
  DriveSession,
  FeedbackInterpretation,
  SeatAdjustmentSource,
  SeatNudge,
  SeatRatios,
} from "../model/bodyfit.types";
import { bodyfitKeys, bodyfitQueries } from "./bodyfit.queries";
import {
  createBodyProfile,
  createComfortRecord,
  createDriveSession,
  createPostureDrive,
  createSeatAdjustment,
  deleteBodyProfile,
  deleteDriveSession,
  findBodyProfile,
  markPostureDriveApplied,
  findDriveSession,
  updateBodyProfile,
} from "./bodyfit.storage";
import {
  askPostureCamera,
  isPostureWatching,
  stopPostureWatching,
  takePostureSamples,
} from "./bodyfit.posture-camera";
import { askByVoice } from "./bodyfit.voice";

export function useCreateBodyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BodyProfileInput) => createBodyProfile(input),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: bodyfitKeys.profiles() }),
  });
}

export function useDeleteBodyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBodyProfile(id),
    onSettled: (_data, _error, id) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: bodyfitKeys.profiles() }),
        queryClient.invalidateQueries({
          queryKey: bodyfitKeys.adjustments(id),
        }),
        queryClient.invalidateQueries({
          queryKey: bodyfitKeys.comfortRecords(id),
        }),
        queryClient.invalidateQueries({
          queryKey: bodyfitKeys.postureDrives(id),
        }),
      ]),
  });
}

/** 시트 이동의 진행 보고와 중단 확인 (자동 조절 진행 화면용). 음성 조절처럼 필요 없으면 넘기지 않는다. */
export type SeatMoveControl = {
  /** 움직일 축이 정해졌을 때(completed 0)와 축 하나가 끝날 때마다 불린다 */
  onProgress?: (steps: AutoAdjustStep[], completed: number) => void;
  /** 참이면 다음 축을 시작하지 않는다. 축 사이에서 멈추기를 눌러도 다음 축이 움직이지 않게 한다 */
  isStopped?: () => boolean;
};

/** 목표 자세(비율)로 운전석을 움직인다. 네이티브 쪽에서 축마다 기어 P 를 다시 확인한다. */
export function useMoveSeat({ onProgress, isStopped }: SeatMoveControl = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: bodyfitKeys.seatMove(),
    mutationFn: async (ratios: SeatRatios) => {
      const vehicle = pleos();
      const state = await vehicle.getDriverSeatState();
      const targets = toSeatTargets(ratios, state);
      if (targets.length === 0) {
        throw Object.assign(new Error("움직일 수 있는 시트 축이 없습니다"), {
          code: "ERR_SEAT_UNSUPPORTED",
        });
      }
      const steps = planAutoAdjust(
        toSeatRatios(state),
        ratios,
        targets.map(({ axis }) => axis),
      );
      onProgress?.(steps, 0);
      // 한 번에 한 축씩 움직인다 (동시에 움직이면 전류 제한으로 멈추는 차량이 있다).
      for (const [index, { axis, target }] of targets.entries()) {
        if (isStopped?.()) return;
        await vehicle.moveDriverSeatAxis(axis, target);
        onProgress?.(steps, index + 1);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: bodyfitKeys.seat() }),
  });
}

export function useStopSeat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => pleos().stopDriverSeat(),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: bodyfitKeys.seat() }),
  });
}

/**
 * 지금 운전석 자세를 이 운전자의 학습 기록으로 남긴다.
 * nudges(터치 피드백)가 있으면 시트를 움직이지 않고 "지금 자세 + 고른 방향"을 받아들인 자세로 기록한다.
 */
export function useRecordSeatAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profile,
      source,
      context,
      nudges = [],
    }: {
      profile: BodyProfile;
      source: SeatAdjustmentSource;
      /** 이 자세로 앉은 운전 상황 (C-5). 같은 상황의 추천에 반영된다 */
      context: DriveContext;
      nudges?: readonly SeatNudge[];
    }) => {
      const state = await pleos().getDriverSeatState();
      await createSeatAdjustment({
        profileId: profile.id,
        at: Date.now(),
        baseline: recommendBaseline(profile),
        final: applyNudges(toSeatRatios(state), nudges),
        source,
        context,
      });
    },
    onSettled: (_data, _error, { profile }) =>
      queryClient.invalidateQueries({
        queryKey: bodyfitKeys.adjustments(profile.id),
      }),
  });
}

/**
 * 출발할 때의 열선·공조 설정을 이 운전자의 온도 취향 기록으로 남긴다.
 * 차량이 지원하는 항목이 하나도 없으면 남기지 않는다.
 */
export function useRecordComfort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId }: { profileId: string }) => {
      const state = await pleos().getDriverComfortState();
      const record = toComfortRecord(profileId, Date.now(), state);
      if (record) await createComfortRecord(record);
    },
    onSettled: (_data, _error, { profileId }) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: bodyfitKeys.comfortRecords(profileId),
        }),
        // 방금 차량에서 다시 읽었으니 화면의 "지금" 값도 새로 읽게 한다.
        queryClient.invalidateQueries({ queryKey: bodyfitKeys.comfort() }),
      ]),
  });
}

/** 운전석 열선·공조를 맞춘다. 네이티브 쪽에서 기어 P 를 다시 확인한다. */
export function useApplyComfort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: ComfortSettings) =>
      pleos().applyDriverComfort(settings),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: bodyfitKeys.comfort() }),
  });
}

/**
 * 주행을 시작할 때 누가 언제 출발했는지 기기에 남긴다.
 * 기어가 P 에서 벗어나면 차량이 앱을 종료할 수 있어, 메모리에만 두면 주행 후 질문(D-1)을 할 수 없다.
 */
export function useStartDriveSession() {
  return useMutation({
    mutationFn: (session: DriveSession) => createDriveSession(session),
  });
}

/**
 * 남겨 둔 주행을 꺼내고 지운다. 주행이 끝났거나 착좌감을 물을 때 부른다.
 * 꺼내는 것과 지우는 것을 한 번에 해서 같은 주행으로 두 번 묻지 않는다.
 */
export function useEndDriveSession() {
  return useMutation({
    mutationFn: async (): Promise<DriveSession | null> => {
      const session = await findDriveSession();
      if (session) await deleteDriveSession();
      return session;
    },
  });
}

/** 운전자의 말을 듣고 시트 조절안으로 바꾼다. question 이 있으면 먼저 음성으로 묻는다. */
export function useVoiceSeatFeedback() {
  return useMutation({
    mutationFn: async ({ question }: { question?: string } = {}) => {
      const utterance = question
        ? await askByVoice(question)
        : await pleos().listen();
      return {
        utterance,
        interpretation: interpretByRules(utterance),
      };
    },
  });
}

export type VoiceAdjustment =
  | { kind: "seat"; interpretation: FeedbackInterpretation }
  | { kind: "comfort"; plan: VoiceComfortPlan }
  | { kind: "none"; reply: string };

/**
 * 운전자의 말을 듣고 시트 조절안이나 온도 조절안으로 바꾼다 (E-4). 여기서는 아무것도 움직이거나 바꾸지 않는다.
 * 온도 조절안은 방금 읽은 차량 상태로 만든다 (운전자가 공조 버튼으로 바꿨을 수 있다).
 * 온도를 맞출 수 없는 빌드(market)에서는 시트 해석만 한다.
 */
export function useVoiceAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileId,
    }: {
      profileId: string;
    }): Promise<VoiceAdjustment> => {
      const utterance = await pleos().listen();
      const request = interpretVoiceRequest(utterance, {
        comfort: canControlComfort,
      });
      if (request.kind !== "comfort") return request;
      const [state, records] = await Promise.all([
        queryClient.fetchQuery(bodyfitQueries.comfort()),
        queryClient.fetchQuery(bodyfitQueries.comfortRecords(profileId)),
      ]);
      const usual =
        recommendComfort(records, state.cabinCurrent ?? null)?.settings ?? null;
      return {
        kind: "comfort",
        plan: planVoiceComfort(request.requests, state, usual),
      };
    },
  });
}

/**
 * 앉은 사람에게 "○○님이시죠?"를 음성으로 묻고 대답을 읽는다 (A-6).
 * 대답은 화면을 넘길지만 정한다. 시트는 넘어간 화면에서 운전자가 확인해야 움직인다.
 */
/** 예/아니오로 답할 질문을 음성으로 묻는다. 답은 신뢰하지 않는 입력이라 "yes"·"no"·"unclear" 로만 읽는다. */
export function useVoiceYesNo() {
  return useMutation({
    mutationFn: async ({ question }: { question: string }) =>
      interpretYesNo(await askByVoice(question)),
  });
}

export function useVoiceDriverConfirm() {
  return useMutation({
    mutationFn: async ({ name }: { name: string }) =>
      interpretYesNo(await askByVoice(`${name}님이시죠?`)),
  });
}

export function useStopListening() {
  return useMutation({ mutationFn: () => pleos().stopListening() });
}

/**
 * 주행 중 카메라로 자세 살펴보기(C-7) 동의를 켜고 끈다. 켤 때는 카메라 권한 창을 띄우고, 거부하면 켜지 않는다.
 * 끄면 카메라를 바로 끄고 그 운전자의 결과도 지운다 (동의 철회 시 데이터 삭제).
 */
export function useUpdatePostureConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileId,
      postureConsent,
    }: {
      profileId: string;
      postureConsent: boolean;
    }): Promise<{ granted: boolean }> => {
      if (postureConsent && !(await askPostureCamera()))
        return { granted: false };
      if (!postureConsent) stopPostureWatching();
      await updateBodyProfile(profileId, { postureConsent });
      return { granted: true };
    },
    onSettled: (_data, _error, { profileId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: bodyfitKeys.profiles() }),
        queryClient.invalidateQueries({
          queryKey: bodyfitKeys.postureDrives(profileId),
        }),
      ]),
  });
}

/**
 * 주행이 끝났을 때 그 주행 동안 모은 관절 표본을 주행 자세 기록(D-6 화면이 읽는 형식)으로 바꿔 남긴다 (C-7).
 * 관찰이 켜져 있지 않았으면 아무것도 하지 않는다. 표본은 꺼내는 순간 네이티브에서 지워진다.
 * 시연 빌드를 에뮬레이터에서 돌리면 시연용 모의 표본으로 바꾸고 기록에 예시(sample)로 표시한다.
 */
export function useAnalyzeDrivePosture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      session,
      endedAt,
      demo,
    }: {
      session: DriveSession;
      endedAt: number;
      /** 시연용 모의 표본을 쓴다 (에뮬레이터 카메라는 고정 사진이라 자세가 변하지 않는다) */
      demo: boolean;
    }): Promise<PostureDrive | null> => {
      if (!isPostureWatching()) return null;
      // 모의 표본을 쓰더라도 카메라 표본은 꺼내서 버린다 (네이티브에 쌓아 두지 않는다).
      const captured = takePostureSamples();
      const profile = await findBodyProfile(session.profileId);
      if (!profile) return null;
      const source = demo
        ? demoCameraSamples(endedAt)
        : { startedAt: session.startedAt, samples: captured };
      const drive = toPostureDrive({
        profileId: profile.id,
        context: session.context,
        startedAt: source.startedAt,
        endedAt,
        heightCm: profile.heightCm,
        samples: source.samples,
        sample: demo,
      });
      if (drive) await createPostureDrive(drive);
      return drive;
    },
    onSettled: (_data, _error, { session }) =>
      queryClient.invalidateQueries({
        queryKey: bodyfitKeys.postureDrives(session.profileId),
      }),
  });
}

/** 주행 자세 리포트의 제안을 반영했다고 그 주행에 남긴다. 같은 주행을 다시 열어도 두 번 반영하지 않는다. */
export function useMarkPostureDriveApplied() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      profileId,
      startedAt,
    }: {
      profileId: string;
      startedAt: number;
    }) => markPostureDriveApplied(profileId, startedAt, Date.now()),
    onSettled: (_data, _error, { profileId }) =>
      queryClient.invalidateQueries({
        queryKey: bodyfitKeys.postureDrives(profileId),
      }),
  });
}
