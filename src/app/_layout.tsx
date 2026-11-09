import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { Providers } from "@/core/providers";

export default function RootLayout() {
  return (
    <Providers>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </Providers>
  );
}
