import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useEffectEvent, useRef } from "react";

import { useAppDispatch, useAppSelector } from "@/core/store/hooks";
import { canUseVoice, isDemoBuild } from "@/shared/config/app-variant";
import type { Gear } from "@/shared/pleos/pleos.types";
import { useGear } from "@/shared/pleos/use-gear";
import { usePleosEvent } from "@/shared/pleos/use-pleos-event";

import {
  useEndDriveSession,
  useRecordComfort,
  useRecordSeatAdjustment,
  useStartDriveSession,
  useVoiceSeatFeedback,
} from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { speakQuietly } from "../api/bodyfit.voice";
import {
  COMFORT_QUESTION,
  comfortPromptFor,
  DEMO_LONG_DRIVE_MS,
  LONG_DRIVE_MS,
  trackGear,
} from "../model/bodyfit-drive";
import {
  feedbackProposed,
  selectActiveDriverId,
  selectDriveContext,
} from "../model/bodyfit-session.slice";
import type { DriveSession } from "../model/bodyfit.types";

/**
 * 화면 없이 주행 흐름을 따라간다.
 * - 주차(P)에서 벗어날 때: 그때의 시트 자세를 운전자가 받아들인 자세로 기록하고 (학습 데이터),
 *   누가 언제 출발했는지 기기에 남긴다. 주행 중에는 차량이 앱을 종료하므로 메모리에 두면 사라진다.
 * - 주차(P)했거나 주차 중에 앱이 다시 켜졌을 때: 남겨 둔 주행이 길었으면 화면으로 착좌감을 묻는다 (D-1).
 *   음성 기능을 쓸 수 있고 동의한 운전자에게는 음성으로 묻고, 조절안이 있으면 확인 화면으로 보낸다.
 */
export function BodyfitDriveMonitor() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const driverId = useAppSelector(selectActiveDriverId);
  const context = useAppSelector(selectDriveContext);
  const driver = useQuery({
    ...bodyfitQueries.profile(driverId ?? ""),
    enabled: driverId !== null,
  });
  const record = useRecordSeatAdjustment();
  const recordComfort = useRecordComfort();
  const startDrive = useStartDriveSession();
  const endDrive = useEndDriveSession();
  const ask = useVoiceSeatFeedback();
  // 현재 기어를 먼저 읽어 둔다. 알림만 기다리면 앱을 켠 뒤 첫 P → D 전환을 기준 없이 받아 출발 기록을 놓친다.
  const gear = useGear();
  const lastGear = useRef<Gear | null>(null);
  // 도착과 주차 알림이 거의 함께 와도 남겨 둔 주행은 한 번만 꺼낸다.
  const endingDrive = useRef(false);
  // 추후 고도화: 마이크를 여는 질문은 음성 기능에 동의한 운전자에게만 한다.
  const voiceReady = canUseVoice && driver.data?.voiceConsent === true;

  const askComfort = (session: DriveSession, parked: boolean) => {
    const prompt = comfortPromptFor({
      startedAt: session.startedAt,
      now: Date.now(),
      parked,
      // 앱이 다시 켜진 뒤에는 운전자를 고르기 전이라 동의 여부를 모른다. 그때는 화면으로 묻는다.
      voice: voiceReady && session.profileId === driverId && !ask.isPending,
      longDriveMs: isDemoBuild ? DEMO_LONG_DRIVE_MS : LONG_DRIVE_MS,
    });
    if (!prompt) return;

    // D-1 주 경로: 화면으로 묻는다. 주차(P) 중에만 띄운다 (S-5).
    // 주행 중 앱이 종료됐다 다시 켜지면 고른 상황이 사라지므로, 출발할 때 남겨 둔 상황을 넘겨 같은 상황의 기록으로 남긴다.
    const askOnScreen = () =>
      router.navigate({
        pathname: "/bodyfit/[profileId]/feedback",
        params: { profileId: session.profileId, context: session.context },
      });
    if (prompt === "screen") {
      askOnScreen();
      return;
    }

    ask.mutate(
      { question: COMFORT_QUESTION },
      {
        // 음성으로 답을 받지 못하면(말이 없거나 인식 실패) 질문을 놓치지 않게 화면으로 다시 묻는다.
        onError: () => {
          if (parked) askOnScreen();
        },
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
            params: { profileId: session.profileId },
          });
        },
      },
    );
  };

  const finishDrive = ({ parked }: { parked: boolean }) => {
    if (endingDrive.current) return;
    endingDrive.current = true;
    endDrive.mutate(undefined, {
      onSuccess: (session) => {
        if (session) askComfort(session, parked);
      },
      onSettled: () => {
        endingDrive.current = false;
      },
    });
  };

  const onGear = useEffectEvent((next: Gear) => {
    const tracked = trackGear(lastGear.current, next);
    lastGear.current = tracked.gear;

    if (tracked.event === "started") {
      // 운전자를 고르지 않았으면 누구의 주행인지 몰라 남기지 않는다.
      if (!driverId) return;
      // 차량이 곧 앱을 종료할 수 있다. 시트를 읽느라 시간이 걸리는 자세 기록보다 출발 시각을 먼저 남긴다.
      startDrive.mutate({
        profileId: driverId,
        startedAt: Date.now(),
        context,
      });
      if (driver.data)
        record.mutate({ profile: driver.data, source: "drive-start", context });
      // 출발할 때의 열선·온도도 함께 기억한다 (다음에 탈 때 같은 취향으로 맞춘다).
      recordComfort.mutate({ profileId: driverId });
    } else if (tracked.event === "parked") {
      finishDrive({ parked: true });
    }
  });

  useEffect(() => {
    if (gear !== null) onGear(gear);
  }, [gear]);

  usePleosEvent("onDestinationArrived", () => {
    const parked = lastGear.current === "park";
    // 달리는 중에는 화면으로 묻지 않는다 (S-5). 주차할 때 끝낸다. 음성으로 물을 수 있을 때만 지금 묻는다.
    if (parked || voiceReady) finishDrive({ parked });
  });

  return null;
}
