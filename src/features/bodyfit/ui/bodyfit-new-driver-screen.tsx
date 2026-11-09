import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { z } from "zod";

import { canUseVoice } from "@/shared/config/app-variant";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Screen } from "@/shared/ui/screen";
import { TextField } from "@/shared/ui/text-field";
import { spacing } from "@/shared/ui/theme";

import { useCreateBodyProfile } from "../api/bodyfit.mutations";
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

  return (
    <Screen
      title="운전자 등록"
      description="체형 정보는 이 차량 안에만 암호화해 저장해요"
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
      <View style={styles.form}>
        <TextField
          label="이름"
          value={values.name}
          onChangeText={change("name")}
          error={errors.name}
          autoComplete="name"
          returnKeyType="next"
        />
        <TextField
          label="키"
          hint="cm"
          value={values.heightCm}
          onChangeText={change("heightCm")}
          error={errors.heightCm}
          keyboardType="decimal-pad"
        />
        <TextField
          label="몸무게"
          hint="kg"
          value={values.weightKg}
          onChangeText={change("weightKg")}
          error={errors.weightKg}
          keyboardType="decimal-pad"
        />
        <TextField
          label="앉은키 (선택)"
          hint="cm · 모르면 비워 두세요. 키로 추정해요"
          value={values.sittingHeightCm}
          onChangeText={change("sittingHeightCm")}
          error={errors.sittingHeightCm}
          keyboardType="decimal-pad"
        />
        <BodyfitConsentNotice
          askVoice={canUseVoice}
          voiceConsent={voiceConsent}
          onVoiceConsentChange={setVoiceConsent}
        />
        {create.isError ? (
          <AppText variant="caption" tone="danger">
            {describeBodyfitError(create.error).title}
          </AppText>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
});
