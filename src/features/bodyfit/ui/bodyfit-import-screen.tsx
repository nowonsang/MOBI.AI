import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { canUseVoice } from "@/shared/config/app-variant";
import {
  PoseCameraView,
  type PoseCameraViewHandle,
} from "@/shared/pose-camera/pose-camera-view";
import type { PoseCameraErrorCode } from "@/shared/pose-camera/pose-camera.types";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Columns } from "@/shared/ui/columns";
import { Divider } from "@/shared/ui/divider";
import { IconBadge } from "@/shared/ui/icon-badge";
import { InfoRow } from "@/shared/ui/info-row";
import { Screen } from "@/shared/ui/screen";
import { StatusView } from "@/shared/ui/status-view";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { useImportBodyProfile } from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import {
  canReadSampleTransfer,
  transferReadMode,
  useParkedForCamera,
  useReadTransferCode,
  useRequestCameraPermission,
} from "../api/bodyfit.transfer";
import { resolveImportName } from "../model/bodyfit-transfer";
import { BodyfitConsentNotice } from "./bodyfit-consent-notice";
import { describeBodyfitError } from "./bodyfit-error-copy";
import {
  describeTransferBody,
  describeTransferCameraError,
  describeTransferFailure,
  describeTransferLearning,
  describeTransferSittingHeight,
} from "./bodyfit-transfer-copy";

const TITLE = "QR 로 가져오기";

const GUIDE = [
  {
    value: "원래 차에서 코드를 만들어요",
    detail: "운전자 화면의 기록 탭 → '다른 차로 가져가기'",
  },
  {
    value: "휴대폰으로 코드를 찍어 와요",
    detail: "코드 전체가 사진에 또렷하게 들어오게 찍어 주세요",
  },
  {
    value: "이 차의 카메라에 사진을 비춰요",
    detail: "휴대폰 화면을 밝게 하고 코드가 크게 보이게 해 주세요",
  },
] as const;

/**
 * QR 로 가져오기 (A-7): 다른 차에서 만든 코드를 카메라로 읽어 새 운전자로 등록한다.
 * 읽기 → 검증 → 미리보기 → 운전자가 "동의하고 가져오기"를 눌러야 저장한다. 읽은 것만으로는 아무것도 저장하지 않는다.
 * 이 화면은 시트를 움직이지 않는다: 가져온 뒤의 이동은 맞춤 자세 화면의 확인 흐름으로만 한다.
 */
export function BodyfitImportScreen() {
  const styles = useStyles();
  const router = useRouter();
  // 기기에 카메라가 있는지는 화면을 여는 동안 바뀌지 않아 한 번만 확인한다.
  const [mode] = useState(transferReadMode);
  const parked = useParkedForCamera();
  const profiles = useQuery(bodyfitQueries.profiles());
  const permission = useRequestCameraPermission();
  const read = useReadTransferCode();
  const save = useImportBodyProfile();

  const cameraRef = useRef<PoseCameraViewHandle>(null);
  // 읽기 한 번마다 번호를 매긴다. 화면을 떠나거나 카메라를 바꾸면 번호가 달라져 진행 중이던 읽기가 멈춘다.
  const readRun = useRef(0);
  const [scanning, setScanning] = useState(false);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [camera, setCamera] = useState<{
    count: number;
    error: PoseCameraErrorCode | null;
  }>({ count: 0, error: null });
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [voiceConsent, setVoiceConsent] = useState(false);

  useEffect(
    () => () => {
      readRun.current += 1;
    },
    [],
  );

  // 진행 중이던 읽기를 버린다: 번호를 올려 다음 장을 읽지 않게 하고, 늦게 오는 결과도 화면에 반영하지 않는다.
  const abandonRead = () => {
    readRun.current += 1;
    read.reset();
  };

  const stopReading = () => {
    abandonRead();
    setScanning(false);
  };

  const startCamera = () => {
    // 권한 창은 이 버튼을 눌렀을 때만 띄운다. 거부해도 직접 등록할 수 있다.
    permission.mutate(undefined, {
      onSuccess: ({ granted }) => {
        setPermissionDenied(!granted);
        if (!granted) return;
        read.reset();
        setCamera({ count: 0, error: null });
        setScanning(true);
      },
      onError: () => setPermissionDenied(true),
    });
  };

  const readFromCamera = () => {
    if (!cameraRef.current) return;
    readRun.current += 1;
    const run = readRun.current;
    read.mutate(
      {
        source: "camera",
        camera: cameraRef.current,
        isCancelled: () => readRun.current !== run,
      },
      // 결과가 나오면 카메라를 끈다 (미리보기·실패 화면은 카메라를 그리지 않는다).
      { onSettled: () => setScanning(false) },
    );
  };

  const readSample = () => {
    stopReading();
    read.mutate({ source: "sample" });
  };

  const retry = () => {
    read.reset();
    save.reset();
    setCamera({ count: 0, error: null });
  };

  const goToNew = () => router.replace("/bodyfit/new");

  if (!mode) {
    return (
      <Screen title={TITLE} width="narrow">
        <StatusView
          title="이 차량에서는 QR 로 가져올 수 없어요"
          description="운전자를 직접 등록해 주세요"
          action={{ label: "운전자 등록하기", onPress: goToNew }}
        />
      </Screen>
    );
  }

  if (!parked) {
    return (
      <Screen title={TITLE} width="narrow">
        <StatusView
          title="주차 중에만 QR 로 가져올 수 있어요"
          description="기어를 P로 바꾼 뒤 다시 시도해 주세요"
          action={{ label: "돌아가기", onPress: () => router.back() }}
        />
      </Screen>
    );
  }

  // 읽은 코드가 검증을 통과했다: 내용을 보여 주고 운전자의 확인을 기다린다. 아직 저장하지 않았다.
  if (read.data?.ok) {
    const { transfer, source } = read.data;
    const learning = describeTransferLearning(transfer);
    const resolved = resolveImportName(
      transfer.name,
      (profiles.data ?? []).map((profile) => profile.name),
    );
    const saveError = save.isError ? describeBodyfitError(save.error) : null;

    return (
      <Screen
        title={`${transfer.name} 님 프로필을 가져올까요?`}
        description="내용을 확인해 주세요. 가져와도 시트는 움직이지 않아요"
        onBack={retry}
        footer={
          <>
            <Button
              label="가져오지 않기"
              variant="secondary"
              onPress={() => router.back()}
            />
            <Button
              label="동의하고 가져오기"
              loading={save.isPending}
              // 같은 이름이 있는지 알려면 운전자 목록을 먼저 읽어야 한다.
              disabled={profiles.isPending}
              onPress={() =>
                save.mutate(
                  { transfer, voiceConsent: canUseVoice && voiceConsent },
                  {
                    onSuccess: (profile) =>
                      router.replace({
                        pathname: "/bodyfit/[profileId]",
                        params: { profileId: profile.id },
                      }),
                  },
                )
              }
            />
          </>
        }
      >
        <Columns
          left={
            <Card title="가져올 내용">
              <View>
                <InfoRow
                  icon={
                    <IconBadge glyph={resolved.name.slice(0, 1)} tone="tint" />
                  }
                  label="체형"
                  value={describeTransferBody(transfer)}
                  detail={describeTransferSittingHeight(transfer)}
                />
                <Divider />
                <InfoRow
                  icon={<IconBadge glyph="✓" tone="tint" />}
                  label="학습한 보정"
                  value={learning.value}
                  detail={learning.detail}
                />
                {resolved.renamed ? (
                  <>
                    <Divider />
                    <InfoRow
                      icon={<IconBadge glyph="+" />}
                      label="같은 이름의 운전자가 이미 있어요"
                      value={`'${resolved.name}' 이름으로 새로 등록해요`}
                      detail={`기존 '${transfer.name}' 운전자와 기록은 그대로 둬요`}
                    />
                  </>
                ) : null}
              </View>
              <AppText variant="caption" tone="tertiary">
                {source === "sample" ? "샘플 코드의 예시 값이에요. " : ""}
                추천 자세는 이 차의 시트 범위로 다시 계산해요. 시트는 맞춤 자세
                화면에서 확인한 뒤에만 움직여요
              </AppText>
            </Card>
          }
          right={
            <>
              <BodyfitConsentNotice
                showCamera={false}
                askVoice={canUseVoice}
                voiceConsent={voiceConsent}
                onVoiceConsentChange={setVoiceConsent}
              />
              {saveError ? (
                <View accessibilityLiveRegion="polite" style={styles.note}>
                  <AppText variant="secondary" tone="danger">
                    {saveError.title}
                  </AppText>
                  <AppText variant="caption" tone="tertiary">
                    {saveError.description}
                  </AppText>
                </View>
              ) : null}
            </>
          }
        />
      </Screen>
    );
  }

  // 받지 않은 코드, 찾지 못한 코드, 카메라 오류: 이유와 다음 행동을 알린다. 아무것도 저장하지 않았다.
  const failure = read.data
    ? describeTransferFailure(read.data.reason)
    : read.error
      ? describeTransferCameraError(read.error)
      : null;
  if (failure) {
    return (
      <Screen
        title={TITLE}
        width="narrow"
        footer={
          <>
            <Button
              label="직접 등록하기"
              variant="secondary"
              onPress={goToNew}
            />
            <Button label="다시 읽기" onPress={retry} />
          </>
        }
      >
        <View accessibilityLiveRegion="polite">
          <StatusView {...failure} />
        </View>
      </Screen>
    );
  }

  const cameraError = camera.error
    ? describeTransferCameraError({ code: camera.error })
    : null;

  return (
    <Screen
      title={TITLE}
      description="다른 차에서 쓰던 체형과 학습한 자세를 이 차로 옮겨요"
      footer={
        scanning ? (
          <Button label="그만 읽기" variant="secondary" onPress={stopReading} />
        ) : mode === "camera" ? (
          <>
            {canReadSampleTransfer ? (
              <Button
                label="샘플 코드로 시연"
                variant="secondary"
                onPress={readSample}
                accessibilityHint="카메라 대신 샘플 코드를 써요"
              />
            ) : null}
            <Button
              label="카메라로 읽기"
              onPress={startCamera}
              loading={permission.isPending}
              accessibilityHint="카메라를 켜고 QR 코드를 찾아요"
            />
          </>
        ) : (
          <Button
            label="샘플 코드로 가져와 보기"
            onPress={readSample}
            loading={read.isPending}
          />
        )
      }
    >
      <Columns
        stretch
        left={
          scanning ? (
            <View style={styles.stack}>
              <View style={styles.preview}>
                <PoseCameraView
                  ref={cameraRef}
                  cameraIndex={cameraIndex}
                  style={styles.camera}
                  onCameraReady={({ nativeEvent }) => {
                    setCamera({ count: nativeEvent.cameraCount, error: null });
                    readFromCamera();
                  }}
                  onCameraError={({ nativeEvent }) => {
                    abandonRead();
                    setCamera({ count: 0, error: nativeEvent.code });
                  }}
                />
              </View>
              <View accessibilityLiveRegion="polite">
                {cameraError ? (
                  <>
                    <AppText variant="secondary" tone="danger">
                      {cameraError.title}
                    </AppText>
                    <AppText variant="caption" tone="tertiary">
                      {cameraError.description}
                    </AppText>
                  </>
                ) : (
                  <AppText variant="caption" tone="tertiary">
                    {read.isPending
                      ? "QR 코드를 찾고 있어요"
                      : "카메라를 켜는 중이에요"}
                  </AppText>
                )}
              </View>
              {camera.count > 1 ? (
                <Button
                  label="다른 카메라로 바꾸기"
                  variant="secondary"
                  onPress={() => {
                    // 카메라가 바뀌면 진행 중이던 읽기는 버리고, 새 카메라가 켜지면 다시 읽는다.
                    abandonRead();
                    setCamera({ count: camera.count, error: null });
                    setCameraIndex((index) => index + 1);
                  }}
                />
              ) : null}
            </View>
          ) : (
            <Card fill>
              <AppText variant="secondary" tone="secondary">
                자세는 이 차의 시트에 맞게 다시 계산해요. 저장하기 전에 내용을
                확인할 수 있어요
              </AppText>
              {permissionDenied || mode === "sample" ? (
                <AppText
                  variant="caption"
                  tone="tertiary"
                  accessibilityLiveRegion="polite"
                >
                  {permissionDenied
                    ? "카메라 권한이 없어요. 차량 설정의 앱 권한에서 카메라를 허용하거나 운전자를 직접 등록해 주세요"
                    : "이 기기에는 카메라가 없어요. 샘플 코드로 대신 보여 줘요"}
                </AppText>
              ) : null}
            </Card>
          )
        }
        right={
          <Card fill title="이렇게 가져와요">
            {GUIDE.map((step, index) => (
              <InfoRow
                key={step.value}
                icon={<IconBadge glyph={`${index + 1}`} tone="tint" />}
                value={step.value}
                detail={step.detail}
              />
            ))}
            <AppText variant="caption" tone="tertiary">
              카메라는 주차 중에 &apos;카메라로 읽기&apos;를 누를 때만 켜요.
              화면은 저장하지 않고 코드에 적힌 내용만 읽어요. QR 인식
              도구(Google ML Kit)가 기기 종류·성능 같은 사용 통계를 Google 에
              보낼 수 있지만 화면과 코드 내용은 보내지 않아요
            </AppText>
          </Card>
        }
      />
    </Screen>
  );
}

const useStyles = themedStyles((colors) => ({
  stack: { gap: spacing.sm },
  note: { gap: spacing.xs },
  // 카메라 화면비(4:3)와 같은 상자. 찍히는 범위 전체가 잘리지 않고 보인다.
  preview: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceDark,
    overflow: "hidden",
  },
  camera: { flex: 1 },
}));
