import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { FeedbackInterpretation } from "./bodyfit.types";

// 이번 주행 세션의 UI 상태. 저장된 프로필·기록은 TanStack Query 캐시가 담당하므로 여기 두지 않는다.
type BodyfitSessionState = {
  /** 지금 운전석에 앉은 운전자 (프로필 id) */
  activeDriverId: string | null;
  /** 기어가 P 에서 벗어난 시각. 장거리 주행 여부를 판단한다. */
  driveStartedAt: number | null;
  /** 운전자 확인을 기다리는 음성 피드백 조절안 */
  pendingFeedback: FeedbackInterpretation | null;
};

const initialState: BodyfitSessionState = {
  activeDriverId: null,
  driveStartedAt: null,
  pendingFeedback: null,
};

export const bodyfitSessionSlice = createSlice({
  name: "bodyfitSession",
  initialState,
  reducers: {
    driverSelected(state, action: PayloadAction<string>) {
      state.activeDriverId = action.payload;
    },
    driveStarted(state, action: PayloadAction<number>) {
      state.driveStartedAt ??= action.payload;
    },
    driveEnded(state) {
      state.driveStartedAt = null;
    },
    feedbackProposed(state, action: PayloadAction<FeedbackInterpretation>) {
      state.pendingFeedback = action.payload;
    },
    feedbackDismissed(state) {
      state.pendingFeedback = null;
    },
  },
  selectors: {
    selectActiveDriverId: (state) => state.activeDriverId,
    selectDriveStartedAt: (state) => state.driveStartedAt,
    selectPendingFeedback: (state) => state.pendingFeedback,
  },
});

export const {
  driverSelected,
  driveStarted,
  driveEnded,
  feedbackProposed,
  feedbackDismissed,
} = bodyfitSessionSlice.actions;

export const {
  selectActiveDriverId,
  selectDriveStartedAt,
  selectPendingFeedback,
} = bodyfitSessionSlice.selectors;
