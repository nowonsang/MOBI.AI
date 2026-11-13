import { useLocalSearchParams } from "expo-router";

import { parseDriveContext } from "@/features/bodyfit/model/bodyfit-drive-context";
import { BodyfitFeedbackScreen } from "@/features/bodyfit/ui/bodyfit-feedback-screen";

export default function BodyfitFeedbackPage() {
  const { profileId, context, postureAt } = useLocalSearchParams<{
    profileId: string;
    context?: string;
    postureAt?: string;
  }>();
  // 화면 주소로 넘어온 값이라 숫자가 아니면 없는 것으로 본다.
  const at = Number(postureAt);
  return (
    <BodyfitFeedbackScreen
      profileId={profileId}
      drivenContext={parseDriveContext(context)}
      postureAt={postureAt && Number.isSafeInteger(at) ? at : null}
    />
  );
}
