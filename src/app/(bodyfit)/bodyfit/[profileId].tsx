import { useLocalSearchParams } from "expo-router";

import { BodyfitSeatScreen } from "@/features/bodyfit/ui/bodyfit-seat-screen";

export default function BodyfitProfilePage() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  return <BodyfitSeatScreen profileId={profileId} />;
}
