import { StyleSheet, useColorScheme } from "react-native";

import {
  colorSchemeFor,
  palettes,
  type Colors,
  type ColorScheme,
} from "./theme";

// StyleSheet.create 가 받는 모양 그대로 (글자 리터럴 타입이 유지되게 같은 제네릭을 쓴다).
type Styles = Parameters<typeof StyleSheet.create>[0];

/** 지금 색 세트 이름. 차량이 주간·야간을 바꾸면 다시 렌더된다. */
export function useThemeScheme(): ColorScheme {
  return colorSchemeFor(useColorScheme());
}

/** 지금 색 세트. 스타일 밖에서 색이 필요할 때(ActivityIndicator, placeholder 등) 쓴다. */
export function useColors(): Colors {
  return palettes[useThemeScheme()];
}

/**
 * 색을 쓰는 스타일 묶음. StyleSheet.create 대신 쓴다:
 *   const useStyles = themedStyles((colors) => ({ box: { backgroundColor: colors.surface } }));
 *   function Box() { const styles = useStyles(); ... }
 * 두 색 세트의 스타일을 미리 만들어 두고 훅은 고르기만 한다 (렌더마다 새로 만들지 않는다).
 */
export function themedStyles<S extends Styles>(
  build: (colors: Colors) => S & Styles,
): () => Readonly<S> {
  const sheets: Record<ColorScheme, Readonly<S>> = {
    day: StyleSheet.create(build(palettes.day)),
    night: StyleSheet.create(build(palettes.night)),
  };
  return function useThemedStyles() {
    return sheets[useThemeScheme()];
  };
}
