import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { Card } from "@/shared/ui/card";
import { Columns } from "@/shared/ui/columns";
import { IconBadge } from "@/shared/ui/icon-badge";
import { InfoRow } from "@/shared/ui/info-row";
import { Screen } from "@/shared/ui/screen";
import { StatusView } from "@/shared/ui/status-view";
import { radius, sizes, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { bodyfitQueries } from "../api/bodyfit.queries";
import { describeBodyfitError } from "./bodyfit-error-copy";
import { BodyfitSeatImage } from "./bodyfit-seat-image";

// 탑승 단계 (A-1·A-2): 운전자를 고르면 바로 맞춤 자세로 간다.
export function BodyfitDriverListScreen() {
  const styles = useStyles();
  const router = useRouter();
  const profiles = useQuery(bodyfitQueries.profiles());
  const goToNew = () => router.push("/bodyfit/new");

  const drivers = profiles.isPending ? (
    <View style={styles.rows} accessibilityLabel="운전자 목록을 불러오는 중">
      {[0, 1].map((key) => (
        <View key={key} style={styles.skeleton} />
      ))}
    </View>
  ) : profiles.isError ? (
    <StatusView
      {...describeBodyfitError(profiles.error)}
      action={{ label: "다시 불러오기", onPress: () => profiles.refetch() }}
    />
  ) : (
    <View style={styles.rows}>
      {profiles.data.length === 0 ? (
        <AppText variant="secondary" tone="secondary">
          등록된 운전자가 없어요. 키와 몸무게만 알려 주시면 첫 자세를 바로
          추천해 드려요
        </AppText>
      ) : (
        profiles.data.map((profile) => (
          <InfoRow
            key={profile.id}
            icon={<IconBadge glyph={profile.name.slice(0, 1)} tone="tint" />}
            value={profile.name}
            detail={`${profile.heightCm}cm · ${profile.weightKg}kg`}
            accessibilityLabel={`${profile.name}, 키 ${profile.heightCm}센티미터`}
            onPress={() =>
              router.push({
                pathname: "/bodyfit/[profileId]",
                params: { profileId: profile.id },
              })
            }
          />
        ))
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="운전자 추가하기"
        onPress={goToNew}
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}
      >
        <AppText variant="body" tone="secondary">
          + 운전자 추가하기
        </AppText>
      </Pressable>
    </View>
  );

  return (
    <Screen
      title="누가 운전하나요?"
      back={false}
      description="운전자를 고르면 몸에 맞는 시트 자세를 추천해 드려요"
    >
      <Columns
        left={
          <>
            <Card>
              <View style={styles.banner}>
                <AppText variant="heading">
                  키와 몸무게만{"\n"}알려 주세요
                </AppText>
                <AppText variant="secondary" tone="tertiary">
                  첫 자세를 바로 추천해 드려요
                </AppText>
              </View>
              <BodyfitSeatImage height={260} />
            </Card>
            <Card>
              <InfoRow
                icon={<IconBadge glyph="✓" tone="tint" />}
                label="개인정보"
                value="이 차량 안에만 저장해요"
                detail="암호화해 저장하고, 운전자가 언제든 지울 수 있어요"
              />
            </Card>
          </>
        }
        right={
          <Card
            title="운전자"
            count={profiles.data ? `${profiles.data.length}명` : undefined}
          >
            {drivers}
          </Card>
        }
      />
    </Screen>
  );
}

const useStyles = themedStyles((colors) => ({
  banner: { gap: spacing.xs },
  // 터치 대상 사이는 최소 24dp
  rows: { gap: spacing.md },
  skeleton: {
    height: sizes.touchTarget + spacing.md,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  add: {
    minHeight: sizes.primaryButton,
    borderRadius: radius.control,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  // Pleos 인터랙션 가이드: 눌린 요소는 줄이고 배경색을 바꾼다.
  pressed: {
    backgroundColor: colors.surfaceMuted,
    transform: [{ scale: 0.98 }],
  },
}));
