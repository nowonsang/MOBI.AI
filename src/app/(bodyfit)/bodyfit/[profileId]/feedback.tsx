import { useLocalSearchParams } from "expo-router";

import { parseDriveContext } from "@/features/bodyfit/model/bodyfit-drive-context";
import { BodyfitFeedbackScreen } from "@/features/bodyfit/ui/bodyfit-feedback-screen";

export default function BodyfitFeedbackPage() {
  const { profileId, context } = useLocalSearchParams<{
    profileId: string;
    context?: string;
  }>();
  return (
    <BodyfitFeedbackScreen
      profileId={profileId}
      drivenContext={parseDriveContext(context)}
    />
  );
}
