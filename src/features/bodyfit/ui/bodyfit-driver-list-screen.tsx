import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Screen } from "@/shared/ui/screen";
import { StatusView } from "@/shared/ui/status-view";
import { colors, radius, sizes, spacing } from "@/shared/ui/theme";

import { bodyfitQueries } from "../api/bodyfit.queries";
import { describeBodyfitError } from "./bodyfit-error-copy";

export function BodyfitDriverListScreen() {
  const router = useRouter();
  const profiles = useQuery(bodyfitQueries.profiles());
  const goToNew = () => router.push("/bodyfit/new");

  return (
    <Screen
      title="누가 운전하나요?"
      description="운전자를 고르면 몸에 맞는 시트 자세를 추천해 드려요"
      footer={
        profiles.data && profiles.data.length > 0 ? (
          <Button label="운전자 추가하기" variant="secondary" onPress={goToNew} />
        ) : null
      }
    >
      {profiles.isPending ? (
        <View style={styles.list} accessibilityLabel="운전자 목록을 불러오는 중">
          {[0, 1].map((key) => (
            <View key={key} style={[styles.row, styles.skeleton]} />
          ))}
        </View>
      ) : profiles.isError ? (
        <StatusView
          {...describeBodyfitError(profiles.error)}
          action={{ label: "다시 불러오기", onPress: () => profiles.refetch() }}
        />
      ) : profiles.data.length === 0 ? (
        <StatusView
          title="등록된 운전자가 없어요"
          description="키와 몸무게만 알려 주시면 첫 자세를 바로 추천해 드려요"
          action={{ label: "운전자 등록하기", onPress: goToNew }}
        />
      ) : (
        <View style={styles.list}>
          {profiles.data.map((profile) => (
            <Pressable
              key={profile.id}
              accessibilityRole="button"
              accessibilityLabel={`${profile.name}, 키 ${profile.heightCm}센티미터`}
              onPress={() =>
                router.push({
                  pathname: "/bodyfit/[profileId]",
                  params: { profileId: profile.id },
                })
              }
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <AppText variant="bodyStrong">{profile.name}</AppText>
              <AppText variant="secondary" tone="tertiary">
                {profile.heightCm}cm · {profile.weightKg}kg
              </AppText>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: {
    minHeight: sizes.touchTarget + spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.control,
    borderWidth: 2,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pressed: { backgroundColor: colors.sandLight },
  skeleton: { backgroundColor: colors.sandLight, borderColor: colors.sandLight },
});
