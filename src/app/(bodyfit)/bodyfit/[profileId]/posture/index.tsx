import { useLocalSearchParams } from "expo-router";

import { BodyfitPostureBaselineScreen } from "@/features/bodyfit/ui/bodyfit-posture-baseline-screen";

export default function BodyfitPosturePage() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  return <BodyfitPostureBaselineScreen profileId={profileId} />;
}
