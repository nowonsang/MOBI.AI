import { useMutation, useQueryClient } from "@tanstack/react-query";

import { pleos } from "@/shared/pleos/pleos";

import {
  planAutoAdjust,
  type AutoAdjustStep,
} from "../model/bodyfit-auto-adjust";
import { toComfortRecord } from "../model/bodyfit-comfort";
import { interpretByRules } from "../model/bodyfit-feedback";
import { recommendBaseline } from "../model/bodyfit-recommend";
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
  SeatAdjustmentSource,
  SeatNudge,
  SeatRatios,
} from "../model/bodyfit.types";
import { bodyfitKeys } from "./bodyfit.queries";
import {
  createBodyProfile,
  createComfortRecord,
  createDriveSession,
  createSeatAdjustment,
  deleteBodyProfile,
  deleteDriveSession,
  findDriveSession,
} from "./bodyfit.storage";
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
      queryClient.invalidateQueries({
        queryKey: bodyfitKeys.comfortRecords(profileId),
      }),
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

export function useStopListening() {
  return useMutation({ mutationFn: () => pleos().stopListening() });
}
