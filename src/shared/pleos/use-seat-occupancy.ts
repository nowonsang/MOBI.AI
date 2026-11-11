import { useEffect, useState } from "react";

import { isPleosAvailable, pleos } from "./pleos";
import { usePleosEvent } from "./use-pleos-event";

/**
 * 운전석 착좌 값 (Pleos SDK 가 알려 준 그대로). 아직 모르거나 차량 환경이 아니면 null.
 * SDK 2.3.2 는 VHAL 값 1 을 true 로 바꾸는데 Android 표준에서 1 은 빈 좌석(VACANT)이다.
 * 참·거짓의 뜻보다 "바뀌었는지"로 쓴다.
 */
export function useDriverSeatOccupancy(): boolean | null {
  const [occupied, setOccupied] = useState<boolean | null>(null);

  usePleosEvent("onDriverSeatOccupancyChanged", (event) =>
    setOccupied(event.occupied),
  );

  useEffect(() => {
    if (!isPleosAvailable()) return;
    let active = true;
    pleos()
      .isDriverSeatOccupied()
      .then(
        // 읽는 사이에 알림이 먼저 왔으면 그 값이 더 새롭다.
        (current) => active && setOccupied((known) => known ?? current),
        // 읽지 못하면 모르는 채로 두고, 알림이 오면 그때부터 따라간다.
        () => undefined,
      );
    return () => {
      active = false;
    };
  }, []);

  return occupied;
}
