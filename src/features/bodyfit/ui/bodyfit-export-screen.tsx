import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Columns } from "@/shared/ui/columns";
import { Divider } from "@/shared/ui/divider";
import { IconBadge } from "@/shared/ui/icon-badge";
import { InfoRow } from "@/shared/ui/info-row";
import { QrCode } from "@/shared/ui/qr-code";
import { qrMatrix } from "@/shared/ui/qr-matrix";
import { Screen } from "@/shared/ui/screen";
import { StatusView } from "@/shared/ui/status-view";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { bodyfitQueries } from "../api/bodyfit.queries";
import { canTransferProfile } from "../api/bodyfit.transfer";
import { buildTransfer, encodeTransfer } from "../model/bodyfit-transfer";
import { describeBodyfitError } from "./bodyfit-error-copy";
import {
  describeTransferBody,
  describeTransferLearning,
  describeTransferSittingHeight,
} from "./bodyfit-transfer-copy";

// 휴대폰으로 찍기 좋은 크기. 카드가 이보다 좁으면 카드 폭에 맞춘다.
const QR_MAX_SIZE = 480;

const STEPS = [
  {
    value: "휴대폰으로 이 코드를 찍어 두세요",
    detail: "코드 전체가 사진에 또렷하게 들어오게 찍어 주세요",
  },
  {
    value: "다른 차의 BodyFit 에서 'QR 로 가져오기'",
    detail: "운전자를 고르는 첫 화면에 있어요",
  },
  {
    value: "찍어 둔 사진을 그 차의 카메라에 비춰요",
    detail: "내용을 확인한 뒤에 그 차에 등록돼요",
  },
] as const;

/**
 * 다른 차로 가져가기 (A-7): 이 운전자의 체형 값과 학습한 보정을 QR 코드로 보여 준다.
 * 서버로 보내지 않고 이 화면에만 그린다. 저장하는 것도, 시트를 움직이는 것도 없다.
 */
export function BodyfitExportScreen({ profileId }: { profileId: string }) {
  const styles = useStyles();
  const router = useRouter();
  const profile = useQuery(bodyfitQueries.profile(profileId));
  const adjustments = useQuery(bodyfitQueries.adjustments(profileId));
  const [boxWidth, setBoxWidth] = useState(0);

  const driver = profile.data;
  const history = adjustments.data;
  const transfer = useMemo(
    () => (driver && history ? buildTransfer(driver, history) : null),
    [driver, history],
  );
  const matrix = useMemo(
    () => (transfer ? qrMatrix(encodeTransfer(transfer)) : null),
    [transfer],
  );

  if (profile.isPending || adjustments.isPending) {
    return (
      <Screen title="다른 차로 가져가기">
        <View
          style={styles.skeleton}
          accessibilityLabel="코드를 만드는 중이에요"
        />
      </Screen>
    );
  }

  if (!canTransferProfile || profile.isError || adjustments.isError) {
    return (
      <Screen title="다른 차로 가져가기">
        <StatusView
          {...describeBodyfitError(profile.error ?? adjustments.error)}
          action={{ label: "돌아가기", onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  if (!transfer || !matrix) {
    return (
      <Screen title="다른 차로 가져가기">
        <StatusView
          title={transfer ? "코드를 만들지 못했어요" : "운전자를 찾지 못했어요"}
          description={
            transfer
              ? "잠시 후 다시 시도해 주세요"
              : "운전자 목록에서 다시 골라 주세요"
          }
          action={{ label: "돌아가기", onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  const learning = describeTransferLearning(transfer);

  return (
    <Screen
      title="다른 차로 가져가기"
      description="렌터카나 다른 차에서도 내 몸에 맞는 자세를 다시 계산해 드려요"
      footer={<Button label="다 찍었어요" onPress={() => router.back()} />}
    >
      <Columns
        stretch
        left={
          <Card fill>
            <View
              style={styles.code}
              onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}
            >
              {boxWidth > 0 ? (
                <QrCode
                  matrix={matrix}
                  size={Math.min(QR_MAX_SIZE, boxWidth)}
                  accessibilityLabel={`${transfer.name} 님의 체형과 자세 보정이 담긴 QR 코드`}
                />
              ) : null}
            </View>
            <View style={styles.notice}>
              <AppText variant="bodyStrong">
                이 코드에는 체형 정보가 들어 있어요
              </AppText>
              <AppText variant="caption" tone="tertiary">
                찍은 사진은 본인만 보관하고, 다 쓴 뒤에는 지워 주세요. 코드는 이
                화면에만 보이고 서버로 보내지 않아요
              </AppText>
            </View>
          </Card>
        }
        right={
          <>
            <Card title="코드에 담긴 정보">
              <View>
                <InfoRow
                  icon={
                    <IconBadge glyph={transfer.name.slice(0, 1)} tone="tint" />
                  }
                  label="이름과 체형"
                  value={transfer.name}
                  detail={`${describeTransferBody(transfer)} · ${describeTransferSittingHeight(transfer)}`}
                />
                <Divider />
                <InfoRow
                  icon={<IconBadge glyph="✓" tone="tint" />}
                  label="학습한 보정"
                  value={learning.value}
                  detail={learning.detail}
                />
              </View>
              <AppText variant="caption" tone="tertiary">
                이 차의 시트 위치가 아니라 체형과 보정값만 담아요. 그래서 다른
                차에서는 그 차의 시트 범위로 자세를 다시 계산해요. 온도 취향과
                기록 시각은 담지 않아요
              </AppText>
            </Card>
            <Card fill title="이렇게 가져가요">
              {STEPS.map((step, index) => (
                <InfoRow
                  key={step.value}
                  icon={<IconBadge glyph={`${index + 1}`} tone="tint" />}
                  value={step.value}
                  detail={step.detail}
                />
              ))}
            </Card>
          </>
        }
      />
    </Screen>
  );
}

const useStyles = themedStyles((colors) => ({
  skeleton: {
    height: 320,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  code: { alignItems: "center" },
  notice: { gap: spacing.xs },
}));
