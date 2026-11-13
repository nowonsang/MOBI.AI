import { useState } from "react";
import { View } from "react-native";

import { canUseCamera } from "@/shared/config/app-variant";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { useUpdatePostureConsent } from "../api/bodyfit.mutations";
import type { BodyProfile } from "../model/bodyfit.types";

/**
 * 주행 중 카메라 관찰(C-7)을 켜고 끄는 카드. 선택 동의라 수집 항목·처리 방법을 알리고 "켜기"를 눌러야 켠다.
 * 켤 때 카메라 권한 창이 뜨고, 끄면 카메라를 끄고 이 운전자의 주행 자세 기록을 지운다.
 */
export function BodyfitPostureWatchToggle({ driver }: { driver: BodyProfile }) {
  const styles = useStyles();
  const consent = useUpdatePostureConsent();
  const [denied, setDenied] = useState(false);

  if (!canUseCamera) return null;

  const setConsent = (postureConsent: boolean) =>
    consent.mutate(
      { profileId: driver.id, postureConsent },
      { onSuccess: ({ granted }) => setDenied(!granted) },
    );

  if (driver.postureConsent) {
    return (
      <Card title="주행 중 자세 관찰">
        <AppText variant="secondary" accessibilityLiveRegion="polite">
          켜져 있어요. 주차하면 이번 주행의 리포트가 생겨요
        </AppText>
        <View style={styles.actions}>
          <Button
            label="끄기"
            variant="secondary"
            onPress={() => setConsent(false)}
            loading={consent.isPending}
            accessibilityHint="카메라를 끄고 주행 자세 기록을 지워요"
          />
        </View>
      </Card>
    );
  }

  return (
    <Card title="주행 중 자세 관찰 (선택)">
      <AppText variant="secondary">
        주행하는 동안 카메라로 머리·어깨·등 위치만 살펴봐요
      </AppText>
      <AppText variant="caption" tone="tertiary">
        영상은 저장하지 않고 이 차량 안에서만 분석해요. 분마다의 변화만 남기고
        끄면 함께 지워요. 자세 인식 도구(Google ML Kit)가 사용 통계를 Google 에
        보낼 수 있지만 화면과 관절 값은 보내지 않아요
      </AppText>
      {denied ? (
        <AppText
          variant="caption"
          tone="danger"
          accessibilityLiveRegion="polite"
        >
          카메라 권한이 없어 켜지 못했어요. 차량 설정에서 카메라를 허용해 주세요
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button
          label="켜기"
          variant="secondary"
          onPress={() => setConsent(true)}
          loading={consent.isPending}
          accessibilityHint="카메라 권한을 묻고 다음 주행부터 살펴봐요"
        />
      </View>
    </Card>
  );
}

const useStyles = themedStyles(() => ({
  // 터치 대상 사이는 최소 24dp
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
}));
