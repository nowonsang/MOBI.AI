import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useEffectEvent, useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/core/store/hooks";
import { canUseVoice } from "@/shared/config/app-variant";
import type { Gear } from "@/shared/pleos/pleos.types";
import { useGear } from "@/shared/pleos/use-gear";
import { usePleosEvent } from "@/shared/pleos/use-pleos-event";

import {
  useRecordSeatAdjustment,
  useVoiceSeatFeedback,
} from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { speakQuietly } from "../api/bodyfit.voice";
import {
  COMFORT_QUESTION,
  comfortPromptFor,
  trackGear,
} from "../model/bodyfit-drive";
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
 * - 오래 달린 뒤 목적지 도착 또는 주차(P): 주차 중에 화면으로 착좌감을 묻는다 (D-1).
 *   음성 기능을 쓸 수 있고 동의한 운전자에게는 음성으로 묻고, 조절안이 있으면 확인 화면으로 보낸다.
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
  // 현재 기어를 먼저 읽어 둔다. 알림만 기다리면 앱을 켠 뒤 첫 P → D 전환을 기준 없이 받아 출발 기록을 놓친다.
  const gear = useGear();
  const lastGear = useRef<Gear | null>(null);
  const askedThisDrive = useRef(false);

  const askComfort = ({ parked }: { parked: boolean }) => {
    if (!driverId || ask.isPending) return;
    const prompt = comfortPromptFor({
      startedAt: driveStartedAt,
      now: Date.now(),
      parked,
      alreadyAsked: askedThisDrive.current,
      // 추후 고도화: 마이크를 여는 질문은 음성 기능에 동의한 운전자에게만 한다.
      voice: canUseVoice && driver.data?.voiceConsent === true,
    });
    if (!prompt) return;
    askedThisDrive.current = true;

    // D-1 주 경로: 화면으로 묻는다. 주차(P) 중에만 띄운다 (S-5). 달리는 중에 도착했다면 주차할 때 다시 온다.
    if (prompt === "screen") {
      router.navigate({
        pathname: "/bodyfit/[profileId]/feedback",
        params: { profileId: driverId },
      });
      return;
    }

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

  const onGear = useEffectEvent((next: Gear) => {
    const tracked = trackGear(lastGear.current, next);
    lastGear.current = tracked.gear;

    if (tracked.event === "started") {
      askedThisDrive.current = false;
      dispatch(driveStarted(Date.now()));
      if (driver.data) record.mutate({ profile: driver.data, source: "drive-start" });
    } else if (tracked.event === "parked") {
      askComfort({ parked: true });
      dispatch(driveEnded());
    }
  });

  useEffect(() => {
    if (gear !== null) onGear(gear);
  }, [gear]);

  usePleosEvent("onDestinationArrived", () =>
    askComfort({ parked: lastGear.current === "park" }),
  );

  return null;
}
