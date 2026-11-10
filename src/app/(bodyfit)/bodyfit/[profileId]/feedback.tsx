import { useLocalSearchParams } from "expo-router";

import { BodyfitFeedbackScreen } from "@/features/bodyfit/ui/bodyfit-feedback-screen";

export default function BodyfitFeedbackPage() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  return <BodyfitFeedbackScreen profileId={profileId} />;
}
