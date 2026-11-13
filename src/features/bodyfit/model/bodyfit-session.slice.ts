import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { DEFAULT_DRIVE_CONTEXT } from "./bodyfit-drive-context";
import type { VoiceComfortPlan } from "./bodyfit-voice-comfort";
import type { DriveContext, FeedbackInterpretation } from "./bodyfit.types";

// 지금 앱을 쓰는 동안의 UI 상태. 저장된 프로필·기록·진행 중인 주행은 기기 저장소가 담당하므로 여기 두지 않는다.
type BodyfitSessionState = {
  /** 지금 운전석에 앉은 운전자 (프로필 id) */
  activeDriverId: string | null;
  /** 운전자가 고른 운전 상황 (C-5). 고르지 않으면 평소다. 상황별 자세 기록은 기기 저장소에 있다 */
  driveContext: DriveContext;
  /** 운전자 확인을 기다리는 음성 피드백 조절안 */
  pendingFeedback: FeedbackInterpretation | null;
  /** 운전자 확인을 기다리는 음성 온도 조절안 (E-4). 시트 조절안과 함께 두지 않는다 */
  pendingComfort: VoiceComfortPlan | null;
  /**
   * 이번 탑승에서 추측한 운전자로 자동으로 넘어가도 되는지. 앱을 켰을 때와 운전석에 앉은 사람이 바뀌었을 때만 true 다.
   * 운전자를 고르거나 "다른 사람이에요"를 누르면 false: 뒤로 가기로 목록에 돌아왔을 때 다시 끌려가지 않게.
   */
  driverGuessPending: boolean;
};

const initialState: BodyfitSessionState = {
  activeDriverId: null,
  driveContext: DEFAULT_DRIVE_CONTEXT,
  pendingFeedback: null,
  pendingComfort: null,
  driverGuessPending: true,
};

export const bodyfitSessionSlice = createSlice({
  name: "bodyfitSession",
  initialState,
  reducers: {
    driverSelected(state, action: PayloadAction<string>) {
      // 상황은 그 운전자가 고른 것이다. 다른 운전자로 바뀌면 이어받지 않고 평소로 돌아간다.
      if (state.activeDriverId !== action.payload) {
        state.driveContext = DEFAULT_DRIVE_CONTEXT;
      }
      state.activeDriverId = action.payload;
      state.driverGuessPending = false;
    },
    /** 운전자가 추측한 운전자가 아니라고 했다. 이번 탑승에서는 목록에서 직접 고르게 둔다. */
    driverGuessDismissed(state) {
      state.driverGuessPending = false;
    },
    /** 운전자가 맞춤 자세 화면에서 상황을 골랐다. 화면이 주차(P) 중에만 고르게 한다 (S-5). */
    driveContextSelected(state, action: PayloadAction<DriveContext>) {
      state.driveContext = action.payload;
    },
    feedbackProposed(state, action: PayloadAction<FeedbackInterpretation>) {
      state.pendingFeedback = action.payload;
      state.pendingComfort = null;
    },
    feedbackDismissed(state) {
      state.pendingFeedback = null;
    },
    comfortProposed(state, action: PayloadAction<VoiceComfortPlan>) {
      state.pendingComfort = action.payload;
      state.pendingFeedback = null;
    },
    comfortDismissed(state) {
      state.pendingComfort = null;
    },
    /**
     * 주차 중에 누가 운전석에 앉거나 일어났다. 다른 사람일 수 있으므로 다시 고를 때까지 운전자를 모르는 상태로 둔다
     * (앞사람 이름으로 출발 자세를 기록하거나 앞사람의 조절안을 보여 주지 않게).
     */
    occupantChanged(state) {
      state.activeDriverId = null;
      state.driveContext = DEFAULT_DRIVE_CONTEXT;
      state.pendingFeedback = null;
      state.pendingComfort = null;
      state.driverGuessPending = true;
    },
  },
  selectors: {
    selectActiveDriverId: (state) => state.activeDriverId,
    selectDriveContext: (state) => state.driveContext,
    selectPendingFeedback: (state) => state.pendingFeedback,
    selectPendingComfort: (state) => state.pendingComfort,
    selectDriverGuessPending: (state) => state.driverGuessPending,
  },
});

export const {
  driverSelected,
  driverGuessDismissed,
  driveContextSelected,
  feedbackProposed,
  feedbackDismissed,
  comfortProposed,
  comfortDismissed,
  occupantChanged,
} = bodyfitSessionSlice.actions;

export const {
  selectActiveDriverId,
  selectDriveContext,
  selectPendingFeedback,
  selectPendingComfort,
  selectDriverGuessPending,
} = bodyfitSessionSlice.selectors;
