import { useWindowDimensions } from "react-native";

import { layout } from "./theme";

/**
 * 제목과 탭을 고정하고 단(Columns) 안에서만 스크롤해도 되는 창인지.
 * 넓고(2단) 충분히 높은 창에서만 켠다. 좁거나 낮은 창은 화면 전체를 스크롤한다.
 */
export function usePinnedLayout(): boolean {
  const { width, height } = useWindowDimensions();
  return width >= layout.twoColumnWidth && height >= layout.pinnedMinHeight;
}
