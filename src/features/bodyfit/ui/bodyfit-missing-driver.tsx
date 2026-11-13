import { useRouter } from "expo-router";

import { Screen } from "@/shared/ui/screen";
import { StatusView } from "@/shared/ui/status-view";

/**
 * 운전자 화면(시트·안내·질문·자세 리포트)에서 운전자를 불러오지 못했을 때.
 * 같은 실패는 어디서나 같은 문구로 보여 준다. 제목과 상태 제목이 같은 말을 되풀이하지 않게 나눈다.
 */
export function BodyfitMissingDriver() {
  const router = useRouter();
  return (
    <Screen title="운전자를 찾지 못했어요" width="narrow">
      <StatusView
        title="지워졌거나 불러오지 못했어요"
        description="목록에서 운전자를 다시 골라 주세요"
        action={{
          label: "운전자 목록으로",
          onPress: () => router.replace("/bodyfit"),
        }}
      />
    </Screen>
  );
}
