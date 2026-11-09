import { useEffect, useState } from "react";

import { isPleosAvailable, pleos } from "./pleos";
import type { UxRestrictions } from "./pleos.types";
import { usePleosEvent } from "./use-pleos-event";

// 모르는 동안에는 막혀 있다고 본다 (안전 쪽으로 실패).
const UNKNOWN: UxRestrictions = {
  requiresDistractionOptimization: true,
  noSetup: true,
};

/**
 * 플랫폼이 지금 막고 있는 UX (CarUxRestrictions). 차량 환경이 아니면 제한 없음.
 * Pleos 주행 규제 가이드: 주행 중 제한은 기어가 아니라 이 값을 기준으로 화면에 반영한다.
 */
export function useUxRestrictions(): UxRestrictions {
  const [restrictions, setRestrictions] = useState<UxRestrictions>(() =>
    isPleosAvailable()
      ? UNKNOWN
      : { requiresDistractionOptimization: false, noSetup: false },
  );

  usePleosEvent("onUxRestrictionsChanged", setRestrictions);

  useEffect(() => {
    if (!isPleosAvailable()) return;
    let active = true;
    pleos()
      .getUxRestrictions()
      .then(
        (current) => active && setRestrictions(current),
        () => active && setRestrictions(UNKNOWN),
      );
    return () => {
      active = false;
    };
  }, []);

  return restrictions;
}
