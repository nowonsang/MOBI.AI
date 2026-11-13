import { useRouter } from "expo-router";

import { AppText } from "@/shared/ui/app-text";
import { Card } from "@/shared/ui/card";

import type { BodyProfile } from "../model/bodyfit.types";

/**
 * 주행 후 질문 화면에서 주행 자세 관찰(D-6 화면)로 이어 주는 카드.
 * 카메라 관찰(C-7)을 켜 둔 운전자는 방금 주행의 리포트로, 아니면 관찰을 켜는 첫 화면으로 보낸다.
 */
export function BodyfitPostureLink({ driver }: { driver: BodyProfile }) {
  const router = useRouter();
  if (driver.postureConsent) {
    return (
      <Card
        title="이번 주행 자세"
        onPress={() =>
          router.push({
            pathname: "/bodyfit/[profileId]/posture/report",
            params: { profileId: driver.id },
          })
        }
        accessibilityLabel="이번 주행 자세 리포트 보기. 카메라로 본 자세 변화를 알려 드려요"
      >
        <AppText variant="secondary" tone="secondary">
          카메라로 본 자세 변화를 리포트로 보여 드려요
        </AppText>
      </Card>
    );
  }
  return (
    <Card
      title="운전 자세 살펴보기 (선택)"
      onPress={() =>
        router.push({
          pathname: "/bodyfit/[profileId]/posture",
          params: { profileId: driver.id },
        })
      }
      accessibilityLabel="운전 자세 살펴보기. 주행 중 카메라로 자세 변화를 살펴보는 기능을 켜요"
    >
      <AppText variant="secondary" tone="secondary">
        주행 중 카메라로 자세가 언제부터 흐트러지는지 살펴볼 수 있어요
      </AppText>
    </Card>
  );
}
