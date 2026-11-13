import { useLocalSearchParams } from "expo-router";

import { BodyfitExportScreen } from "@/features/bodyfit/ui/bodyfit-export-screen";

export default function BodyfitExportPage() {
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  return <BodyfitExportScreen profileId={profileId} />;
}
