import { useEffect, useState } from "react";

import { isPleosAvailable, pleos } from "./pleos";
import type { Gear } from "./pleos.types";
import { usePleosEvent } from "./use-pleos-event";

/** 현재 기어. 아직 모르면 null, 차량 환경이 아니면 "unknown". */
export function useGear(): Gear | null {
  const [gear, setGear] = useState<Gear | null>(() =>
    isPleosAvailable() ? null : "unknown",
  );

  usePleosEvent("onGearChanged", (event) => setGear(event.gear));

  useEffect(() => {
    if (!isPleosAvailable()) return;
    let active = true;
    pleos()
      .getGear()
      .then(
        (current) => active && setGear(current),
        () => active && setGear("unknown"),
      );
    return () => {
      active = false;
    };
  }, []);

  return gear;
}
