import { Stack } from "expo-router";

import { BodyfitBoardingMonitor } from "@/features/bodyfit/ui/bodyfit-boarding-monitor";
import { BodyfitDriveMonitor } from "@/features/bodyfit/ui/bodyfit-drive-monitor";
import { colors } from "@/shared/ui/theme";

// 헤더(뒤로 가기)는 공용 Screen 이 그린다. 네이티브 헤더와 함께 쓰면 제목 위 여백이 두 번 들어간다.
export default function BodyfitLayout() {
  return (
    <>
      <BodyfitBoardingMonitor />
      <BodyfitDriveMonitor />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
        }}
      />
    </>
  );
}
