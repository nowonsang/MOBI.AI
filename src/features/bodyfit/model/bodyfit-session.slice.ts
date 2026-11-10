import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { FeedbackInterpretation } from "./bodyfit.types";

// 지금 앱을 쓰는 동안의 UI 상태. 저장된 프로필·기록·진행 중인 주행은 기기 저장소가 담당하므로 여기 두지 않는다.
type BodyfitSessionState = {
  /** 지금 운전석에 앉은 운전자 (프로필 id) */
  activeDriverId: string | null;
  /** 운전자 확인을 기다리는 음성 피드백 조절안 */
  pendingFeedback: FeedbackInterpretation | null;
};

const initialState: BodyfitSessionState = {
  activeDriverId: null,
  pendingFeedback: null,
};

export const bodyfitSessionSlice = createSlice({
  name: "bodyfitSession",
  initialState,
  reducers: {
    driverSelected(state, action: PayloadAction<string>) {
      state.activeDriverId = action.payload;
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
    selectPendingFeedback: (state) => state.pendingFeedback,
  },
});

export const { driverSelected, feedbackProposed, feedbackDismissed } =
  bodyfitSessionSlice.actions;

export const { selectActiveDriverId, selectPendingFeedback } =
  bodyfitSessionSlice.selectors;
