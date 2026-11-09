import { useLocalSearchParams } from "expo-router";

import { BodyfitGuideScreen } from "@/features/bodyfit/ui/bodyfit-guide-screen";

export default function BodyfitGuidePage() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  return <BodyfitGuideScreen profileId={profileId} />;
}
