import { Stack } from "expo-router";

import { BodyfitDriveMonitor } from "@/features/bodyfit/ui/bodyfit-drive-monitor";
import { colors, typography } from "@/shared/ui/theme";

export default function BodyfitLayout() {
  return (
    <>
      <BodyfitDriveMonitor />
      <Stack
        screenOptions={{
          title: "",
          headerShadowVisible: false,
          headerTintColor: colors.primary,
          headerTitleStyle: { fontSize: typography.secondary.fontSize },
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Screen name="bodyfit/index" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
