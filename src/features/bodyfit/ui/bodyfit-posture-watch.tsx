import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { useAppSelector } from "@/core/store/hooks";
import { canUseCamera } from "@/shared/config/app-variant";
import { useGear } from "@/shared/pleos/use-gear";

import {
  canWatchPosture,
  ensurePostureWatch,
  stopPostureWatching,
} from "../api/bodyfit.posture-camera";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { selectActiveDriverId } from "../model/bodyfit-session.slice";

// 주차하면 시스템이 가렸던 앱을 다시 보여 준다. 화면이 완전히 돌아오기 전에 시작하면
// Android 가 "백그라운드에서 시작한 카메라 서비스"로 보고 막는다 (에뮬레이터에서 확인, 11/13).
const START_DELAY_MS = 1500;

/**
 * 화면 없이 주행 중 자세 관찰(C-7)을 켜고 끈다.
 * 고른 운전자가 동의했으면, 앱이 화면에 보이는 주차 중에 카메라 서비스를 켜 둔다. 주행 중에도 서비스는 계속 돈다.
 * 동의를 끄거나 운전자를 고르지 않으면 끈다. 분석은 주행이 끝날 때 주행 감시(BodyfitDriveMonitor)가 한다.
 */
export function BodyfitPostureWatch() {
  const driverId = useAppSelector(selectActiveDriverId);
  const driver = useQuery({
    ...bodyfitQueries.profile(driverId ?? ""),
    enabled: driverId !== null,
  });
  const gear = useGear();
  const [active, setActive] = useState(AppState.currentState === "active");
  const wanted =
    canUseCamera && driverId !== null && driver.data?.postureConsent === true;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setActive(state === "active"),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!wanted) {
      stopPostureWatching();
      return;
    }
    if (gear !== "park" || !active) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void canWatchPosture().then((ready) => {
        if (!ready || cancelled) return;
        try {
          ensurePostureWatch();
        } catch {
          // 권한이 없거나 카메라를 열지 못하면 이번에는 살펴보지 않는다. 다음 주차 때 다시 시도한다.
        }
      });
    }, START_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wanted, gear, active]);

  return null;
}
