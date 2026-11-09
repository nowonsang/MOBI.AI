import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/core/store/hooks";
import { canUseVoice } from "@/shared/config/app-variant";
import type { Gear } from "@/shared/pleos/pleos.types";
import { usePleosEvent } from "@/shared/pleos/use-pleos-event";

import {
  useRecordSeatAdjustment,
  useVoiceSeatFeedback,
} from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { speakQuietly } from "../api/bodyfit.voice";
import { COMFORT_QUESTION, isLongDrive } from "../model/bodyfit-drive";
import {
  driveEnded,
  driveStarted,
  feedbackProposed,
  selectActiveDriverId,
  selectDriveStartedAt,
} from "../model/bodyfit-session.slice";

/**
 * 화면 없이 주행 흐름을 따라간다.
 * - 주차(P)에서 벗어날 때: 그때의 시트 자세를 운전자가 받아들인 자세로 기록한다 (학습 데이터).
 * - 오래 달린 뒤 목적지 도착 또는 주차(P): 착좌감을 음성으로 묻고, 조절안이 있으면 확인 화면으로 보낸다.
 */
export function BodyfitDriveMonitor() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const driverId = useAppSelector(selectActiveDriverId);
  const driveStartedAt = useAppSelector(selectDriveStartedAt);
  const driver = useQuery({
    ...bodyfitQueries.profile(driverId ?? ""),
    enabled: driverId !== null,
  });
  const record = useRecordSeatAdjustment();
  const ask = useVoiceSeatFeedback();
  const lastGear = useRef<Gear | null>(null);
  const askedThisDrive = useRef(false);

  const askComfort = () => {
    if (!driverId || askedThisDrive.current || ask.isPending) return;
    // 마이크를 여는 질문은 음성 기능에 동의한 운전자에게만 한다.
    if (!canUseVoice || !driver.data?.voiceConsent) return;
    if (!isLongDrive(driveStartedAt, Date.now())) return;
    askedThisDrive.current = true;
    ask.mutate(
      { question: COMFORT_QUESTION },
      {
        onSuccess: ({ interpretation }) => {
          if (interpretation.nudges.length === 0) {
            void speakQuietly(interpretation.reply);
            return;
          }
          dispatch(feedbackProposed(interpretation));
          void speakQuietly(
            `${interpretation.reply}. 차를 세운 뒤 화면에서 확인해 주세요`,
          );
          router.navigate({
            pathname: "/bodyfit/[profileId]",
            params: { profileId: driverId },
          });
        },
      },
    );
  };

  usePleosEvent("onGearChanged", ({ gear }) => {
    const previous = lastGear.current;
    lastGear.current = gear;
    if (previous === null || previous === gear) return;

    if (previous === "park") {
      askedThisDrive.current = false;
      dispatch(driveStarted(Date.now()));
      if (driver.data) record.mutate({ profile: driver.data, source: "drive-start" });
    } else if (gear === "park") {
      askComfort();
      dispatch(driveEnded());
    }
  });

  usePleosEvent("onDestinationArrived", () => askComfort());

  return null;
}
