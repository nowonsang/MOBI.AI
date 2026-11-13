import { useLocalSearchParams } from "expo-router";

import { BodyfitPostureReportScreen } from "@/features/bodyfit/ui/bodyfit-posture-report-screen";

export default function BodyfitPostureReportPage() {
  const { profileId, startedAt } = useLocalSearchParams<{
    profileId: string;
    startedAt?: string;
  }>();
  // 화면 주소로 넘어온 값이라 숫자가 아니면 가장 최근 주행을 연다.
  const at = Number(startedAt);
  return (
    <BodyfitPostureReportScreen
      profileId={profileId}
      startedAt={startedAt && Number.isSafeInteger(at) ? at : null}
    />
  );
}
