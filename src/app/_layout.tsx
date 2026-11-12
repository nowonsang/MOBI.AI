import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";

import { Providers } from "@/core/providers";
import { useColors } from "@/shared/ui/use-theme";

export default function RootLayout() {
  const colors = useColors();

  // 화면 전환·키보드 뒤로 비치는 루트 바탕도 주간·야간을 따라가게 한다 (야간에 흰 면이 번쩍이지 않게).
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.surfaceMuted);
  }, [colors.surfaceMuted]);

  return (
    <Providers>
      {/* auto: 주간에는 어두운 글자, 야간에는 밝은 글자 */}
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surfaceMuted },
        }}
      />
    </Providers>
  );
}
