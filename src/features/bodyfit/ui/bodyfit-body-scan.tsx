import { useEffect, useRef, useState } from "react";
import { BackHandler, View } from "react-native";

import {
  PoseCameraView,
  type PoseCameraViewHandle,
} from "@/shared/pose-camera/pose-camera-view";
import type { PoseCameraErrorCode } from "@/shared/pose-camera/pose-camera.types";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Columns } from "@/shared/ui/columns";
import { IconBadge } from "@/shared/ui/icon-badge";
import { InfoRow } from "@/shared/ui/info-row";
import { Screen } from "@/shared/ui/screen";
import { StatusView } from "@/shared/ui/status-view";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import {
  canScanSample,
  useParkedForBodyScan,
  useScanBody,
  type BodyScanMode,
} from "../api/bodyfit.body-scan";
import { SAMPLE_POSE_CAPTURE, toPoseFigure } from "../model/bodyfit-body-scan";
import {
  describeBodyScanError,
  describeBodyScanFailure,
} from "./bodyfit-body-scan-copy";
import { BodyfitPoseFigure } from "./bodyfit-pose-figure";

type Props = {
  /** 운전자가 입력한 키. 사진의 축척으로 쓴다 */
  heightCm: number;
  mode: BodyScanMode;
  /** 운전자가 "이 값 채우기"를 눌렀을 때. 저장은 등록 버튼에서 한다 */
  onUse: (sittingHeightCm: number, source: BodyScanMode) => void;
  onClose: () => void;
};

// 화면을 누른 뒤 카메라 앞에 설 시간. 차 밖에 서서 전신이 보여야 하므로 바로 찍지 않는다.
const COUNTDOWN_SECONDS = 5;

const COUNTDOWN_BADGE = 144;

const SAMPLE_FIGURE = toPoseFigure(SAMPLE_POSE_CAPTURE);

const GUIDE = [
  {
    value: "차 밖에 서 주세요",
    detail: "앉은 채로는 다리가 가려져 추정할 수 없어요",
  },
  {
    value: "머리부터 발끝까지 화면에 들어오게",
    detail: "카메라에서 2~3m 떨어지면 전신이 들어와요",
  },
  {
    value: "정면을 보고 팔을 내린 채 똑바로",
    detail: "두꺼운 겉옷을 벗으면 관절이 더 잘 잡혀요",
  },
] as const;

/**
 * 카메라로 앉은키 재기 (A-5). 운전자 등록 화면 안에서 여는 한 단계다:
 * 촬영 안내 → 5초 뒤 한 장 분석 → 결과 확인 → 입력 칸에 채움. 화면은 저장하지 않고 관절 점만 보여 준다.
 * 이 화면은 값을 저장하거나 시트를 움직이지 않는다.
 */
export function BodyfitBodyScan({
  heightCm,
  mode: initialMode,
  onUse,
  onClose,
}: Props) {
  const styles = useStyles();
  const parked = useParkedForBodyScan();
  const { mutate, reset, data, error, isPending } = useScanBody();
  const cameraRef = useRef<PoseCameraViewHandle>(null);
  const [mode, setMode] = useState(initialMode);
  const [cameraIndex, setCameraIndex] = useState(0);
  const [camera, setCamera] = useState<{
    ready: boolean;
    count: number;
    error: PoseCameraErrorCode | null;
  }>({ ready: false, count: 0, error: null });
  const [countdown, setCountdown] = useState<number | null>(null);

  // 시스템 뒤로 가기는 등록 화면을 떠나지 않고 이 단계만 닫는다 (입력하던 값을 잃지 않게).
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose]);

  useEffect(() => {
    if (countdown === null) return;
    const timer = setTimeout(() => {
      if (countdown > 1) return setCountdown(countdown - 1);
      setCountdown(null);
      if (cameraRef.current) {
        mutate({ source: "camera", camera: cameraRef.current, heightCm });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [countdown, heightCm, mutate]);

  const retry = () => {
    setCamera({ ready: false, count: 0, error: null });
    reset();
  };

  if (!parked) {
    return (
      <Screen title="카메라로 앉은키 재기" width="narrow" onBack={onClose}>
        <StatusView
          title="주차 중에만 카메라로 잴 수 있어요"
          description="기어를 P로 바꾼 뒤 다시 시도하거나, 앉은키를 직접 입력해 주세요"
          action={{ label: "돌아가기", onPress: onClose }}
        />
      </Screen>
    );
  }

  // 분석이 끝난 뒤: 사진은 이미 버려졌고 관절 점만 남아 있다. 카메라도 꺼진다 (미리보기를 그리지 않는다).
  if (data || error) {
    const failure = error
      ? describeBodyScanError(error)
      : data && !data.result.ok
        ? describeBodyScanFailure(data.result.reason)
        : null;
    const estimate = data?.result.ok ? data.result.sittingHeightCm : null;
    const sample = data?.source === "sample";

    return (
      <Screen
        title="카메라로 앉은키 재기"
        description={
          estimate !== null
            ? "추정값이에요. 맞는지 확인하고 채워 주세요"
            : undefined
        }
        onBack={onClose}
        footer={
          estimate !== null && data ? (
            <>
              <Button
                label={sample ? "다시 재 보기" : "다시 찍기"}
                variant="secondary"
                onPress={retry}
              />
              <Button
                label="이 값 채우기"
                onPress={() => onUse(estimate, data.source)}
              />
            </>
          ) : (
            <>
              <Button
                label="직접 입력하기"
                variant="secondary"
                onPress={onClose}
              />
              <Button label="다시 찍기" onPress={retry} />
            </>
          )
        }
      >
        <Columns
          left={
            data?.figure ? (
              <View style={styles.figure}>
                <BodyfitPoseFigure
                  figure={data.figure}
                  label={
                    sample
                      ? "샘플 자세의 관절 위치 그림"
                      : "방금 인식한 관절 위치 그림"
                  }
                />
                <AppText variant="caption" tone="tertiary">
                  {sample
                    ? "샘플 자세 데이터예요. 실제로 찍은 화면이 아니에요"
                    : "화면은 저장하지 않고 관절 위치만 읽었어요"}
                </AppText>
              </View>
            ) : null
          }
          right={
            <View accessibilityLiveRegion="polite">
              {estimate !== null ? (
                <Card>
                  <AppText variant="title" accessibilityRole="header">
                    앉은키 약 {estimate}cm 로 보여요
                  </AppText>
                  <AppText variant="body">
                    맞는지 확인해 주세요. 입력 칸에 채운 뒤에도 고칠 수 있어요
                  </AppText>
                  <AppText variant="caption" tone="tertiary">
                    {sample
                      ? `샘플 자세와 입력한 키 ${heightCm}cm 로 계산한 예시 값이에요. 실제 앉은키가 아니에요`
                      : `입력한 키 ${heightCm}cm 와 화면 속 상체·다리 비율로 추정한 값이라 실제와 다를 수 있어요`}
                  </AppText>
                </Card>
              ) : failure ? (
                <StatusView
                  title={failure.title}
                  description={failure.description}
                />
              ) : null}
            </View>
          }
        />
      </Screen>
    );
  }

  const usingCamera = mode === "camera";
  const cameraError = camera.error
    ? describeBodyScanError({ code: camera.error })
    : null;
  const counting = countdown !== null;

  return (
    <Screen
      title="카메라로 앉은키 재기"
      description={
        usingCamera
          ? "주차 중에만 쓸 수 있어요. 누르면 5초 뒤에 한 장을 읽어요"
          : "이 기기에서는 샘플 자세 데이터로 흐름만 보여 드려요"
      }
      onBack={onClose}
      footer={
        usingCamera ? (
          <>
            {canScanSample && !counting ? (
              <Button
                label="샘플 자세로 시연"
                variant="secondary"
                onPress={() => setMode("sample")}
                accessibilityHint="카메라 대신 샘플 자세 데이터로 흐름을 보여 줘요"
              />
            ) : null}
            {counting ? (
              <Button
                label="취소"
                variant="secondary"
                onPress={() => setCountdown(null)}
              />
            ) : null}
            <Button
              label={
                counting ? `${countdown}초 뒤에 읽어요` : "5초 뒤 촬영하기"
              }
              onPress={() => setCountdown(COUNTDOWN_SECONDS)}
              disabled={!camera.ready || counting}
              loading={isPending}
            />
          </>
        ) : (
          <Button
            label="샘플 자세로 재 보기"
            onPress={() => mutate({ source: "sample", heightCm })}
            loading={isPending}
          />
        )
      }
    >
      <Columns
        stretch
        left={
          usingCamera ? (
            <View style={styles.figure}>
              <View style={styles.preview}>
                <PoseCameraView
                  ref={cameraRef}
                  cameraIndex={cameraIndex}
                  style={styles.camera}
                  onCameraReady={({ nativeEvent }) =>
                    setCamera({
                      ready: true,
                      count: nativeEvent.cameraCount,
                      error: null,
                    })
                  }
                  onCameraError={({ nativeEvent }) =>
                    setCamera({
                      ready: false,
                      count: 0,
                      error: nativeEvent.code,
                    })
                  }
                />
                {counting ? (
                  <View style={styles.countdown} pointerEvents="none">
                    <View style={styles.countdownBadge}>
                      <AppText
                        variant="display"
                        tone="inverse"
                        accessibilityLiveRegion="polite"
                      >
                        {countdown}
                      </AppText>
                    </View>
                  </View>
                ) : null}
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
                    {camera.ready
                      ? "화면은 저장하지 않아요. 한 장만 읽고 바로 버려요"
                      : "카메라를 켜는 중이에요"}
                  </AppText>
                )}
              </View>
              {camera.count > 1 && !counting ? (
                <Button
                  label="다른 카메라로 바꾸기"
                  variant="secondary"
                  onPress={() => {
                    setCamera({
                      ready: false,
                      count: camera.count,
                      error: null,
                    });
                    setCameraIndex((index) => index + 1);
                  }}
                />
              ) : null}
            </View>
          ) : SAMPLE_FIGURE ? (
            <View style={styles.figure}>
              <BodyfitPoseFigure
                figure={SAMPLE_FIGURE}
                label="샘플 자세의 관절 위치 그림"
              />
              <AppText variant="caption" tone="tertiary">
                샘플 자세 데이터예요. 사람을 찍은 것이 아니라 표준 인체 비율로
                만든 예시예요
              </AppText>
            </View>
          ) : null
        }
        right={
          <Card
            fill
            title={
              usingCamera ? "이렇게 찍어 주세요" : "실제로는 이렇게 찍어요"
            }
          >
            {GUIDE.map((step, index) => (
              <InfoRow
                key={step.value}
                icon={<IconBadge glyph={`${index + 1}`} tone="tint" />}
                value={step.value}
                detail={step.detail}
              />
            ))}
            <AppText variant="caption" tone="tertiary">
              입력한 키 {heightCm}cm 를 기준으로 관절 비율만 읽어 앉은키를
              추정해요. 키와 몸무게는 카메라로 재지 않아요
            </AppText>
          </Card>
        }
      />
    </Screen>
  );
}

const useStyles = themedStyles((colors) => ({
  figure: { gap: spacing.sm },
  // 카메라 화면비(4:3)와 같은 상자. 찍히는 범위 전체가 잘리지 않고 보인다.
  preview: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceDark,
    overflow: "hidden",
  },
  camera: { flex: 1 },
  countdown: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  // 멀리 서서도 보이게 크게. 주간·야간 모두 읽히도록 primary 면 위에 숫자를 올린다.
  countdownBadge: {
    width: COUNTDOWN_BADGE,
    height: COUNTDOWN_BADGE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
}));
