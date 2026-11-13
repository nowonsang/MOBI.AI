import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import {
  useDismissPostureReport,
  useRecordSeatAdjustment,
  useUpdatePostureConsent,
} from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { describeNudges } from "../model/bodyfit-feedback";
import { describePosture } from "../model/bodyfit-posture";
import type { BodyProfile, DriveContext } from "../model/bodyfit.types";
import { describeBodyfitError } from "./bodyfit-error-copy";

/**
 * C-7 주행 중 자세 살펴보기. 주행 후 질문 화면에서 보여 준다.
 * - 동의 전: 무엇을 하는지 알리고 켜기 (권한 창은 이때만 뜬다)
 * - 결과가 있으면: 언제부터 어떻게 무너졌는지 + 다음 자세 조절안. 반영해야 기록에 들어간다 (시트는 움직이지 않는다)
 */
export function BodyfitPostureCard({
  driver,
  context,
  canAnswer,
}: {
  driver: BodyProfile;
  /** 반영하면 이 상황의 기록으로 남긴다 (C-5) */
  context: DriveContext;
  /** 주차 중이고 차량에 연결돼 있을 때만 답할 수 있다 */
  canAnswer: boolean;
}) {
  const styles = useStyles();
  const report = useQuery(bodyfitQueries.postureReport(driver.id));
  const consent = useUpdatePostureConsent();
  const record = useRecordSeatAdjustment();
  const dismiss = useDismissPostureReport();
  const [denied, setDenied] = useState(false);
  const [applied, setApplied] = useState(false);

  const setConsent = (postureConsent: boolean) =>
    consent.mutate(
      { profileId: driver.id, postureConsent },
      { onSuccess: ({ granted }) => setDenied(!granted) },
    );

  if (report.isPending) {
    return <View style={styles.skeleton} accessibilityLabel="불러오는 중" />;
  }

  const result = report.data;
  if (result) {
    const drifted = result.nudges.length > 0;
    const apply = () =>
      record.mutate(
        {
          profile: driver,
          source: "camera",
          context,
          nudges: result.nudges,
        },
        {
          onSuccess: () => {
            setApplied(true);
            dismiss.mutate(driver.id);
          },
        },
      );
    return (
      <Card title="카메라로 본 오늘 자세">
        {result.demo ? (
          <View style={styles.tag}>
            <AppText variant="caption">시연용 예시 자세로 보여 드려요</AppText>
          </View>
        ) : null}
        <AppText variant="body" accessibilityLiveRegion="polite">
          {describePosture(result)}
        </AppText>
        {drifted ? (
          <AppText variant="secondary" tone="secondary">
            다음에는 {describeNudges(result.nudges)}
          </AppText>
        ) : null}
        <View style={styles.actions}>
          <Button
            label={drifted ? "넘기기" : "확인"}
            variant="secondary"
            onPress={() => dismiss.mutate(driver.id)}
            loading={dismiss.isPending && !record.isPending}
            disabled={record.isPending}
            accessibilityHint={
              drifted ? "다음 추천에 반영하지 않고 결과를 지워요" : undefined
            }
          />
          {drifted ? (
            <Button
              label="다음 추천에 반영하기"
              variant="secondary"
              onPress={apply}
              disabled={!canAnswer}
              loading={record.isPending}
              accessibilityHint="시트는 움직이지 않고 다음 추천에만 반영해요"
            />
          ) : null}
        </View>
        {record.error ? (
          <AppText variant="caption" tone="danger">
            {describeBodyfitError(record.error).title}
          </AppText>
        ) : null}
      </Card>
    );
  }

  if (driver.postureConsent) {
    return (
      <Card title="운전 자세 살펴보기">
        <AppText variant="secondary" accessibilityLiveRegion="polite">
          {applied
            ? "다음 추천에 반영했어요. 다음 주행도 살펴볼게요"
            : "켜져 있어요. 주행이 끝나면 언제부터 자세가 흐트러졌는지 알려 드려요"}
        </AppText>
        <View style={styles.actions}>
          <Button
            label="끄기"
            variant="secondary"
            onPress={() => setConsent(false)}
            loading={consent.isPending}
            accessibilityHint="카메라를 끄고 살펴본 결과를 지워요"
          />
        </View>
      </Card>
    );
  }

  return (
    <Card title="운전 자세 살펴보기 (선택)">
      <AppText variant="secondary">
        주행하는 동안 카메라로 머리와 어깨 위치만 살펴보고, 언제부터 자세가
        흐트러졌는지 알려 드려요
      </AppText>
      <AppText variant="caption" tone="tertiary">
        영상은 저장하지 않고 이 차량 안에서만 분석해요. 결과 요약만 남기고 끄면
        함께 지워요. 자세 인식 도구(Google ML Kit)가 사용 통계를 Google 에 보낼
        수 있지만 화면과 관절 값은 보내지 않아요
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

const useStyles = themedStyles((colors) => ({
  skeleton: {
    height: 240,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  // 터치 대상 사이는 최소 24dp
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  // 옅은 파랑 면 + ink 글자 (theme.test 의 검사 조합)
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
}));
