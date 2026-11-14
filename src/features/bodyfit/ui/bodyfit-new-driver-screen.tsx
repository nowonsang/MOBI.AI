import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { z } from "zod";

import { canUseCamera, canUseVoice } from "@/shared/config/app-variant";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { isPoseCameraAvailable } from "@/shared/pose-camera/pose-camera";
import { Screen } from "@/shared/ui/screen";
import { TextField, type TextFieldHandle } from "@/shared/ui/text-field";
import { spacing } from "@/shared/ui/theme";

import { useCreateBodyProfile } from "../api/bodyfit.mutations";
import { useRequestCameraPermission } from "../api/bodyfit.transfer";
import { parseMeasurement } from "../model/bodyfit-drive";
import { bodyProfileInputSchema } from "../model/bodyfit.schema";
import { BodyfitConsentNotice } from "./bodyfit-consent-notice";
import { describeBodyfitError } from "./bodyfit-error-copy";

type Field = "name" | "heightCm" | "weightKg" | "sittingHeightCm";

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
  // 주행 자세 관찰은 카메라가 있는 기기·빌드에서만 묻는다. 화면을 여는 동안 바뀌지 않아 한 번만 확인한다.
  const [hasCamera] = useState(() => canUseCamera && isPoseCameraAvailable());
  const permission = useRequestCameraPermission();
  // 키보드의 "다음" 키로 다음 칸에 바로 넘어간다 (입력칸을 다시 찾아 누르지 않게).
  const heightRef = useRef<TextFieldHandle>(null);
  const weightRef = useRef<TextFieldHandle>(null);
  const sittingRef = useRef<TextFieldHandle>(null);

  const change = (field: Field) => (text: string) =>
    setValues((current) => ({ ...current, [field]: text }));

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

  return (
    <Screen
      title="운전자 등록"
      description="이름, 키, 몸무게만 있으면 돼요"
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
              onChangeText={change("heightCm")}
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
        <TextField
          label="앉은키 (cm, 선택)"
          hint="모르면 비워 두세요. 키로 추정해요"
          value={values.sittingHeightCm}
          onChangeText={change("sittingHeightCm")}
          error={errors.sittingHeightCm}
          keyboardType="decimal-pad"
          ref={sittingRef}
          returnKeyType="done"
        />
      </Card>
      <BodyfitConsentNotice
        showCamera={hasCamera}
        askVoice={canUseVoice}
        voiceConsent={voiceConsent}
        onVoiceConsentChange={setVoiceConsent}
        askPosture={hasCamera}
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
  error: { gap: spacing.xs },
});
