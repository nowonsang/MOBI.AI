import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Fragment } from "react";
import { View } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { Card } from "@/shared/ui/card";
import { Columns } from "@/shared/ui/columns";
import { Divider } from "@/shared/ui/divider";
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

  // 오른쪽 단: 불러오는 중 → 실패 → 빈 상태(등록이 유일한 행동이라 주 CTA) → 목록
  const drivers = profiles.isPending ? (
    <Card title="운전자">
      <View accessibilityLabel="운전자 목록을 불러오는 중">
        {[0, 1].map((key) => (
          // 실제 행과 같은 모양(아바타 원 + 두 줄)이라 불러온 뒤 화면이 출렁이지 않는다.
          <View key={key} style={styles.skeletonRow}>
            <View style={styles.skeletonAvatar} />
            <View style={styles.skeletonText}>
              <View style={[styles.skeletonBar, styles.skeletonName]} />
              <View style={[styles.skeletonBar, styles.skeletonDetail]} />
            </View>
          </View>
        ))}
      </View>
    </Card>
  ) : profiles.isError ? (
    <StatusView
      {...describeBodyfitError(profiles.error)}
      action={{ label: "다시 불러오기", onPress: () => profiles.refetch() }}
    />
  ) : profiles.data.length === 0 ? (
    <StatusView
      title="아직 등록된 운전자가 없어요"
      description="키와 몸무게만 알려 주시면 첫 자세를 바로 추천해 드려요"
      action={{ label: "운전자 등록하기", onPress: goToNew }}
    />
  ) : (
    <Card title="운전자" count={`${profiles.data.length}명`}>
      <View>
        {profiles.data.map((profile) => (
          <Fragment key={profile.id}>
            <View style={styles.row}>
              <InfoRow
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
            </View>
            <Divider />
          </Fragment>
        ))}
        {/* 운전자 행과 같은 모양으로 목록 끝에 둔다. 고르는 것이 이 화면의 주 행동이라 주 CTA 로 키우지 않는다. */}
        <View style={styles.row}>
          <InfoRow
            icon={<IconBadge glyph="+" />}
            value="운전자 추가하기"
            valueTone="accent"
            onPress={goToNew}
          />
        </View>
      </View>
    </Card>
  );

  return (
    <Screen
      title="누가 운전하나요?"
      back={false}
      description="운전자를 고르면 몸에 맞는 시트 자세로 바로 가요"
    >
      <Columns
        left={
          <Card>
            <View style={styles.seat}>
              <BodyfitSeatImage height={260} />
            </View>
            <View style={styles.intro}>
              <AppText variant="heading">체형에 맞춰 시트를 추천해요</AppText>
              <AppText variant="secondary" tone="tertiary">
                키와 몸무게로 첫 자세를 계산하고, 탈수록 취향을 배워요
              </AppText>
            </View>
            <Divider />
            <InfoRow
              icon={<IconBadge glyph="✓" tone="tint" />}
              label="개인정보"
              value="이 차량 안에만 저장해요"
              detail="암호화해 저장하고, 언제든 지울 수 있어요"
            />
          </Card>
        }
        right={drivers}
      />
    </Screen>
  );
}

const useStyles = themedStyles((colors) => ({
  seat: {
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
  },
  intro: { gap: spacing.xs },
  // 행 위아래 여백으로 터치 대상 사이 24dp 를 확보한다 (구분선 포함).
  row: { paddingVertical: spacing.xs },
  skeletonRow: {
    minHeight: sizes.touchTarget + spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  skeletonAvatar: {
    width: sizes.iconBadge,
    height: sizes.iconBadge,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  skeletonText: { flex: 1, gap: spacing.xs },
  skeletonBar: { borderRadius: radius.control, backgroundColor: colors.surfaceMuted },
  skeletonName: { width: "40%", height: spacing.lg },
  skeletonDetail: { width: "60%", height: spacing.md },
}));
