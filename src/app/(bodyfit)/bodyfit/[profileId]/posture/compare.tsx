import { useLocalSearchParams } from "expo-router";

import { parseDriveContext } from "@/features/bodyfit/model/bodyfit-drive-context";
import { BodyfitPostureCompareScreen } from "@/features/bodyfit/ui/bodyfit-posture-compare-screen";

export default function BodyfitPostureComparePage() {
  const { profileId, context } = useLocalSearchParams<{
    profileId: string;
    context?: string;
  }>();
  return (
    <BodyfitPostureCompareScreen
      profileId={profileId}
      context={parseDriveContext(context)}
    />
  );
}
