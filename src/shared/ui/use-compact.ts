import { useWindowDimensions } from "react-native";

import { layout } from "./theme";

/** 좁은 창인지 (layout.compactWidth 미만). 창 크기·방향이 바뀌면 다시 계산된다. */
export function useCompact(): boolean {
  return useWindowDimensions().width < layout.compactWidth;
}
