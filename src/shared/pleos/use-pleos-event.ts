import { useEffect, useEffectEvent } from "react";

import { PleosConnect } from "@modules/pleos-connect/src/PleosConnectModule";

import { isPleosAvailable } from "./pleos";
import type { PleosConnectEvents } from "./pleos.types";

type EventPayload<Name extends keyof PleosConnectEvents> = Parameters<
  PleosConnectEvents[Name]
>[0];

/** 차량 이벤트를 구독한다. 차량 환경이 아니면 아무것도 하지 않는다. */
export function usePleosEvent<Name extends keyof PleosConnectEvents>(
  name: Name,
  listener: (event: EventPayload<Name>) => void,
) {
  // 리스너가 바뀌어도 구독을 다시 걸지 않는다.
  const onEvent = useEffectEvent(listener);

  useEffect(() => {
    if (!PleosConnect || !isPleosAvailable()) return;
    const subscription = PleosConnect.addListener(name, ((
      event: EventPayload<Name>,
    ) => onEvent(event)) as PleosConnectEvents[Name]);
    return () => subscription.remove();
  }, [name]);
}
