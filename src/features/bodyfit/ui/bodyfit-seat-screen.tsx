import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { useAppDispatch } from "@/core/store/hooks";
import { canControlSeat, canUseVoice } from "@/shared/config/app-variant";
import { isPleosAvailable } from "@/shared/pleos/pleos";
import { useGear } from "@/shared/pleos/use-gear";
import { useUxRestrictions } from "@/shared/pleos/use-ux-restrictions";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Screen } from "@/shared/ui/screen";
import { StatusView } from "@/shared/ui/status-view";
import { colors, radius, spacing } from "@/shared/ui/theme";

import {
  useDeleteBodyProfile,
  useMoveSeat,
  useStopSeat,
} from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { speakQuietly } from "../api/bodyfit.voice";
import { learnOffsets } from "../model/bodyfit-learning";
import { recommendSeat } from "../model/bodyfit-recommend";
import { toSeatRatios } from "../model/bodyfit-seat";
import { driverSelected } from "../model/bodyfit-session.slice";
import { describeBodyfitError } from "./bodyfit-error-copy";
import { BodyfitSeatAxes } from "./bodyfit-seat-axes";
import { BodyfitVoiceFeedback } from "./bodyfit-voice-feedback";

const MOVE_CONFIRM = {
  title: "시트를 움직일게요",
  description: "시트 주변에 물건이나 사람이 끼지 않았는지 확인해 주세요",
};

export function BodyfitSeatScreen({ profileId }: { profileId: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const vehicleConnected = isPleosAvailable();
  const profile = useQuery(bodyfitQueries.profile(profileId));
  const adjustments = useQuery(bodyfitQueries.adjustments(profileId));
  const seat = useQuery({
    ...bodyfitQueries.seat(),
    enabled: vehicleConnected,
  });
  const gear = useGear();
  const restrictions = useUxRestrictions();
  const move = useMoveSeat();
  const stop = useStopSeat();
  const remove = useDeleteBodyProfile();
  const [notice, setNotice] = useState<string | null>(null);

  // 이 화면을 연 운전자를 이번 주행의 운전자로 본다 (주행 시작 자세·주행 후 질문에 쓴다).
  useEffect(() => {
    dispatch(driverSelected(profileId));
  }, [dispatch, profileId]);

  if (profile.isPending || adjustments.isPending) {
    return (
      <Screen title="자세를 계산하고 있어요">
        <View style={styles.skeleton} accessibilityLabel="불러오는 중" />
      </Screen>
    );
  }

  if (profile.isError || adjustments.isError || !profile.data) {
    return (
      <Screen title="운전자 정보를 찾지 못했어요">
        <StatusView
          title="운전자 정보가 없어요"
          description="목록에서 운전자를 다시 골라 주세요"
          action={{
            label: "운전자 목록으로",
            onPress: () => router.replace("/bodyfit"),
          }}
        />
      </Screen>
    );
  }

  const driver = profile.data;
  const recommended = recommendSeat(driver, learnOffsets(adjustments.data));
  const current = seat.data ? toSeatRatios(seat.data) : null;
  // 시트 조절은 플랫폼 제한(CarUxRestrictions NO_SETUP)이 없고 기어가 P 일 때만 연다.
  // 네이티브도 움직이기 전과 도중에 기어 P 를 다시 확인한다 (DriverSeat.kt).
  const parked = gear === "park" && !restrictions.noSetup;
  const learnedCount = adjustments.data.length;

  const applyRecommendation = () =>
    Alert.alert(MOVE_CONFIRM.title, MOVE_CONFIRM.description, [
      { text: "취소", style: "cancel" },
      {
        text: "맞추기",
        onPress: () =>
          move.mutate(recommended, {
            onSuccess: () => {
              setNotice("추천 자세로 맞췄어요");
              void speakQuietly(
                "추천 자세로 맞췄어요. 불편한 곳이 있으면 말로 알려 주세요",
              );
            },
          }),
      },
    ]);

  // 주 경로: 운전자가 시트 버튼으로 맞추고 화면이 안내한다 (시트 제어 SDK 가 Coming Soon 이라도 동작한다).
  const openGuide = () =>
    router.push({
      pathname: "/bodyfit/[profileId]/guide",
      params: { profileId: driver.id },
    });

  const confirmDelete = () =>
    Alert.alert(
      `${driver.name}님의 정보를 지울까요?`,
      "체형 정보와 자세 기록이 모두 지워지고 되돌릴 수 없어요",
      [
        { text: "취소", style: "cancel" },
        {
          text: "지우기",
          style: "destructive",
          onPress: () =>
            remove.mutate(driver.id, {
              onSuccess: () => router.replace("/bodyfit"),
            }),
        },
      ],
    );

  const error = move.error ?? seat.error;

  return (
    <Screen
      title={`${driver.name}님 맞춤 자세`}
      description={
        learnedCount > 0
          ? `체형과 지금까지의 자세 기록 ${learnedCount}건을 반영했어요`
          : "체형으로 계산한 첫 추천이에요. 쓰실수록 몸에 맞춰져요"
      }
      footer={
        <>
          {!canControlSeat ? null : move.isPending ? (
            <Button
              label="멈추기"
              variant="secondary"
              onPress={() => stop.mutate()}
            />
          ) : (
            // 확장 경로 (B-4): 시트 제어 권한이 열리면 쓰는 자동 조절.
            <Button
              label="자동으로 맞추기"
              variant="secondary"
              onPress={applyRecommendation}
              disabled={!vehicleConnected || !parked}
              accessibilityHint="기어가 P 일 때만 시트가 움직여요"
            />
          )}
          <Button
            label="안내 받으며 맞추기"
            onPress={openGuide}
            disabled={!vehicleConnected || move.isPending}
            accessibilityHint="시트 버튼을 움직이면 화면이 축별로 알려 드려요"
          />
        </>
      }
    >
      <View style={styles.status} accessibilityLiveRegion="polite">
        <AppText variant="bodyStrong">
          {!vehicleConnected
            ? "차량에 연결되어 있지 않아요"
            : parked
              ? "주차 중이에요. 안내를 보며 시트를 맞출 수 있어요"
              : "주행 중에는 시트를 맞추지 않아요"}
        </AppText>
        {!vehicleConnected ? (
          <AppText variant="secondary" tone="secondary">
            Pleos Connect 에뮬레이터나 차량에서 열면 시트를 맞출 수 있어요
          </AppText>
        ) : null}
      </View>

      <BodyfitSeatAxes recommended={recommended} current={current} />

      {notice ? (
        <AppText
          variant="secondary"
          tone="secondary"
          accessibilityLiveRegion="polite"
        >
          {notice}
        </AppText>
      ) : null}
      {error ? <StatusView {...describeBodyfitError(error)} /> : null}

      {vehicleConnected && canUseVoice && driver.voiceConsent ? (
        <BodyfitVoiceFeedback
          profile={driver}
          seat={seat.data}
          parked={parked}
        />
      ) : null}

      <View style={styles.manage}>
        <Button
          label="운전자 정보 지우기"
          variant="secondary"
          onPress={confirmDelete}
          loading={remove.isPending}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    height: 320,
    borderRadius: radius.control,
    backgroundColor: colors.sandLight,
  },
  status: {
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.control,
    backgroundColor: colors.sandLight,
  },
  manage: { alignItems: "flex-start" },
});
