import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { z } from "zod";

import { canUseCamera, canUseVoice } from "@/shared/config/app-variant";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { TextField, type TextFieldHandle } from "@/shared/ui/text-field";
import { spacing } from "@/shared/ui/theme";

import {
  bodyScanMode,
  useParkedForBodyScan,
  useRequestCameraPermission,
  type BodyScanMode,
} from "../api/bodyfit.body-scan";
import { useCreateBodyProfile } from "../api/bodyfit.mutations";
import { parseMeasurement } from "../model/bodyfit-drive";
import { bodyProfileInputSchema } from "../model/bodyfit.schema";
import { BodyfitBodyScan } from "./bodyfit-body-scan";
import { BodyfitConsentNotice } from "./bodyfit-consent-notice";
import { describeBodyfitError } from "./bodyfit-error-copy";

type Field = "name" | "heightCm" | "weightKg" | "sittingHeightCm";

// 앉은키 칸 아래 한 줄: 카메라로 재기를 왜 못 쓰는지, 채운 값이 어디서 왔는지.
const SCAN_NOTE = {
  notParked: "카메라로 재기는 주차(P) 중에만 쓸 수 있어요",
  denied:
    "카메라 권한이 없어요. 직접 입력하거나 차량 설정의 앱 권한에서 카메라를 허용해 주세요",
  sampleOnly:
    "이 기기에는 카메라가 없어요. 샘플 자세 데이터로 흐름만 보여 드려요",
  camera: "카메라로 추정한 값이에요. 다르면 고쳐 주세요",
  sample: "샘플 자세로 채운 예시 값이에요. 실제 앉은키로 고쳐 주세요",
} as const;

export function BodyfitNewDriverScreen() {
  const router = useRouter();
  const create = useCreateBodyProfile();
  const [values, setValues] = useState<Record<Field, string>>({
    name: "",
    heightCm: "",
    weightKg: "",
    sittingHeightCm: "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [voiceConsent, setVoiceConsent] = useState(false);
  // 주행 중 자세 관찰(C-7) 선택 동의. 체크할 때 카메라 권한을 묻고, 받지 못하면 체크하지 않는다.
  const [postureConsent, setPostureConsent] = useState(false);
  const [postureDenied, setPostureDenied] = useState(false);
  // 카메라로 재기 (A-5). 기기에 카메라가 있는지는 화면을 여는 동안 바뀌지 않아 한 번만 확인한다.
  const [scanMode] = useState(bodyScanMode);
  const parked = useParkedForBodyScan();
  const permission = useRequestCameraPermission();
  // 열려 있는 동안 등록 화면 대신 카메라 단계를 보여 준다. 입력하던 값은 이 컴포넌트에 그대로 남는다.
  const [scan, setScan] = useState<{
    mode: BodyScanMode;
    heightCm: number;
  } | null>(null);
  const [scanNote, setScanNote] = useState<keyof typeof SCAN_NOTE | null>(null);
  // 키보드의 "다음" 키로 다음 칸에 바로 넘어간다 (입력칸을 다시 찾아 누르지 않게).
  const heightRef = useRef<TextFieldHandle>(null);
  const weightRef = useRef<TextFieldHandle>(null);
  const sittingRef = useRef<TextFieldHandle>(null);

  const change = (field: Field) => (text: string) =>
    setValues((current) => ({ ...current, [field]: text }));

  const openScan = () => {
    // 키가 사진의 자 역할을 하므로 키부터 받는다.
    const height = bodyProfileInputSchema.shape.heightCm.safeParse(
      parseMeasurement(values.heightCm),
    );
    if (!height.success) {
      setErrors((current) => ({
        ...current,
        heightCm: values.heightCm.trim()
          ? "키는 120~220cm 사이로 입력해 주세요"
          : "키를 먼저 입력해 주세요. 키와 관절 비율로 앉은키를 추정해요",
      }));
      heightRef.current?.focus();
      return;
    }
    setErrors((current) => ({ ...current, heightCm: undefined }));
    if (scanMode !== "camera") {
      setScan({ mode: "sample", heightCm: height.data });
      return;
    }
    // 권한 창은 이 버튼을 눌렀을 때만 띄운다. 거부해도 직접 입력으로 등록할 수 있다.
    permission.mutate(undefined, {
      onSuccess: ({ granted }) => {
        if (granted) {
          setScanNote(null);
          setScan({ mode: "camera", heightCm: height.data });
        } else {
          setScanNote("denied");
        }
      },
      onError: () => setScanNote("denied"),
    });
  };

  const submit = () => {
    // 입력은 너그럽게 받는다: "175cm", "175.5" 모두 숫자만 읽는다.
    const parsed = bodyProfileInputSchema.safeParse({
      name: values.name,
      heightCm: parseMeasurement(values.heightCm),
      weightKg: parseMeasurement(values.weightKg),
      sittingHeightCm: values.sittingHeightCm.trim()
        ? parseMeasurement(values.sittingHeightCm)
        : null,
      voiceConsent: canUseVoice && voiceConsent,
      postureConsent: canUseCamera && postureConsent,
    });
    if (!parsed.success) {
      const fieldErrors = z.flattenError(parsed.error).fieldErrors;
      setErrors({
        name: fieldErrors.name?.[0],
        heightCm: fieldErrors.heightCm?.[0],
        weightKg: fieldErrors.weightKg?.[0],
        sittingHeightCm: fieldErrors.sittingHeightCm?.[0],
      });
      return;
    }
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: (profile) =>
        router.replace({
          pathname: "/bodyfit/[profileId]",
          params: { profileId: profile.id },
        }),
    });
  };

  const createError = create.isError
    ? describeBodyfitError(create.error)
    : null;

  if (scan) {
    return (
      <BodyfitBodyScan
        heightCm={scan.heightCm}
        mode={scan.mode}
        onClose={() => setScan(null)}
        onUse={(sittingHeightCm, source) => {
          // 입력 칸을 미리 채우기만 한다. 운전자가 확인·수정한 뒤 등록 버튼으로 저장한다.
          setValues((current) => ({
            ...current,
            sittingHeightCm: String(sittingHeightCm),
          }));
          setErrors((current) => ({ ...current, sittingHeightCm: undefined }));
          setScanNote(source);
          setScan(null);
        }}
      />
    );
  }

  const scanNoteKey =
    scanNote ??
    (scanMode && !parked
      ? "notParked"
      : scanMode === "sample"
        ? "sampleOnly"
        : null);

  return (
    <Screen
      title="운전자 등록"
      description="키와 몸무게만 있으면 첫 자세를 바로 추천해요"
      width="narrow"
      footer={
        <>
          <Button
            label="동의하지 않아요"
            variant="secondary"
            onPress={() => router.back()}
          />
          <Button
            label="동의하고 등록하기"
            onPress={submit}
            loading={create.isPending}
          />
        </>
      }
    >
      <Card title="체형 정보">
        <TextField
          label="이름"
          value={values.name}
          onChangeText={change("name")}
          error={errors.name}
          autoComplete="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => heightRef.current?.focus()}
        />
        {/* 키·몸무게는 한 줄에 두어 스크롤을 줄인다. 좁은 창에서는 줄바꿈되어 위아래로 쌓인다. */}
        <View style={styles.pair}>
          <View style={styles.pairItem}>
            <TextField
              label="키 (cm)"
              value={values.heightCm}
              onChangeText={(text) => {
                change("heightCm")(text);
                // "카메라로 재기"가 띄운 안내는 키를 고치면 바로 지운다.
                setErrors((current) => ({ ...current, heightCm: undefined }));
              }}
              error={errors.heightCm}
              keyboardType="decimal-pad"
              ref={heightRef}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => weightRef.current?.focus()}
            />
          </View>
          <View style={styles.pairItem}>
            <TextField
              label="몸무게 (kg)"
              value={values.weightKg}
              onChangeText={change("weightKg")}
              error={errors.weightKg}
              keyboardType="decimal-pad"
              ref={weightRef}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => sittingRef.current?.focus()}
            />
          </View>
        </View>
        {/* 앉은키 칸 옆에 "카메라로 재기". 좁은 창에서는 버튼이 칸 아래로 내려간다. */}
        <View style={styles.sitting}>
          <View style={styles.pairItem}>
            <TextField
              label="앉은키 (cm, 선택)"
              hint="모르면 비워 두세요. 키로 추정해요"
              value={values.sittingHeightCm}
              onChangeText={(text) => {
                // 운전자가 고친 값은 더 이상 카메라 추정값이 아니다.
                if (scanNote === "camera" || scanNote === "sample") {
                  setScanNote(null);
                }
                change("sittingHeightCm")(text);
              }}
              error={errors.sittingHeightCm}
              keyboardType="decimal-pad"
              ref={sittingRef}
              returnKeyType="done"
            />
          </View>
          {scanMode ? (
            <Button
              label={
                scanMode === "camera" ? "카메라로 재기" : "샘플 자세로 재 보기"
              }
              variant="secondary"
              onPress={openScan}
              disabled={!parked}
              loading={permission.isPending}
              accessibilityHint="카메라로 서 있는 모습 한 장을 읽어 앉은키를 추정해요. 화면은 저장하지 않아요"
            />
          ) : null}
        </View>
        {scanNoteKey ? (
          <AppText
            variant="caption"
            tone="tertiary"
            accessibilityLiveRegion="polite"
          >
            {SCAN_NOTE[scanNoteKey]}
          </AppText>
        ) : null}
      </Card>
      <BodyfitConsentNotice
        showCamera={scanMode === "camera"}
        askVoice={canUseVoice}
        voiceConsent={voiceConsent}
        onVoiceConsentChange={setVoiceConsent}
        askPosture={canUseCamera && scanMode === "camera"}
        postureConsent={postureConsent}
        onPostureConsentChange={(next) => {
          setPostureDenied(false);
          if (!next) {
            setPostureConsent(false);
            return;
          }
          permission.mutate(undefined, {
            onSuccess: ({ granted }) => {
              setPostureConsent(granted);
              setPostureDenied(!granted);
            },
            onError: () => setPostureDenied(true),
          });
        }}
        postureNote={
          postureDenied
            ? "카메라 권한이 없어 켜지 못했어요. 차량 설정에서 카메라를 허용해 주세요"
            : null
        }
      />
      {/* 저장 실패는 하단 버튼 바로 위에 이유와 다음 행동을 함께 알린다. */}
      {createError ? (
        <View accessibilityLiveRegion="polite" style={styles.error}>
          <AppText variant="secondary" tone="danger">
            {createError.title}
          </AppText>
          <AppText variant="caption" tone="tertiary">
            {createError.description}
          </AppText>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  // 두 칸이 나란히 들어가지 않는 좁은 창에서는 한 칸씩 쌓인다.
  pairItem: { flex: 1, minWidth: 280 },
  // 버튼을 입력칸 바닥에 맞춘다 (라벨·안내 줄 높이만큼 내려온다).
  sitting: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: spacing.md,
  },
  error: { gap: spacing.xs },
});
