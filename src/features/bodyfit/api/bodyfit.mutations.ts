import { useMutation, useQueryClient } from "@tanstack/react-query";

import { pleos } from "@/shared/pleos/pleos";

import { interpretByRules } from "../model/bodyfit-feedback";
import { recommendBaseline } from "../model/bodyfit-recommend";
import { toSeatRatios, toSeatTargets } from "../model/bodyfit-seat";
import type {
  BodyProfile,
  BodyProfileInput,
  SeatAdjustmentSource,
  SeatRatios,
} from "../model/bodyfit.types";
import { bodyfitKeys } from "./bodyfit.queries";
import {
  createBodyProfile,
  createSeatAdjustment,
  deleteBodyProfile,
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
      ]),
  });
}

/** 목표 자세(비율)로 운전석을 움직인다. 네이티브 쪽에서 축마다 기어 P 를 다시 확인한다. */
export function useMoveSeat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ratios: SeatRatios) => {
      const vehicle = pleos();
      const targets = toSeatTargets(
        ratios,
        await vehicle.getDriverSeatState(),
      );
      if (targets.length === 0) {
        throw Object.assign(
          new Error("움직일 수 있는 시트 축이 없습니다"),
          { code: "ERR_SEAT_UNSUPPORTED" },
        );
      }
      // 한 번에 한 축씩 움직인다 (동시에 움직이면 전류 제한으로 멈추는 차량이 있다).
      for (const { axis, target } of targets) {
        await vehicle.moveDriverSeatAxis(axis, target);
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

/** 지금 운전석 자세를 이 운전자의 학습 기록으로 남긴다. */
export function useRecordSeatAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profile,
      source,
    }: {
      profile: BodyProfile;
      source: SeatAdjustmentSource;
    }) => {
      const state = await pleos().getDriverSeatState();
      await createSeatAdjustment({
        profileId: profile.id,
        at: Date.now(),
        baseline: recommendBaseline(profile),
        final: toSeatRatios(state),
        source,
      });
    },
    onSettled: (_data, _error, { profile }) =>
      queryClient.invalidateQueries({
        queryKey: bodyfitKeys.adjustments(profile.id),
      }),
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
