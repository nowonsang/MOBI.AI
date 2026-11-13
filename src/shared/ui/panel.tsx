import { createContext, useContext } from "react";

/**
 * 한 장의 카드(패널) 안에 놓였는지. 패널 안의 Card 는 상자를 그리지 않고 구역(제목 + 내용 + 아래 선)이 되고,
 * SegmentedTabs 는 패널 머리에 붙는다. 카드 안에 카드가 겹쳐 네모가 많아 보이는 것을 막는다.
 */
export const PanelContext = createContext(false);

export function useInPanel(): boolean {
  return useContext(PanelContext);
}
