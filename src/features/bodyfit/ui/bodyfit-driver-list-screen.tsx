import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Fragment, useState } from "react";
import { View } from "react-native";

import { useAppDispatch, useAppSelector } from "@/core/store/hooks";
import { canUseVoice } from "@/shared/config/app-variant";
import { isPleosAvailable } from "@/shared/pleos/pleos";
import { useGear } from "@/shared/pleos/use-gear";
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
import { AUTO_START_CONFIDENCE, guessDriver } from "../model/bodyfit-identify";
import {
  driverGuessDismissed,
  selectDriverGuessPending,
} from "../model/bodyfit-session.slice";
import { BodyfitDriverGuess } from "./bodyfit-driver-guess";
import { describeBodyfitError } from "./bodyfit-error-copy";
import { BodyfitSeatImage } from "./bodyfit-seat-image";

// 탑승 단계 (A-1·A-2): 운전자를 고르면 바로 맞춤 자세로 간다.
export function BodyfitDriverListScreen() {
  const styles = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const profiles = useQuery(bodyfitQueries.profiles());
  const boardings = useQuery(bodyfitQueries.boardings());
  const guessPending = useAppSelector(selectDriverGuessPending);
  const gear = useGear();
  // 화면을 연 시각 기준으로 한 번만 추측한다 (렌더마다 시각이 바뀌어 추측이 흔들리지 않게).
  const [openedAt] = useState(() => Date.now());
  const goToNew = () => router.push("/bodyfit/new");
  const openDriver = (profileId: string) =>
    router.push({ pathname: "/bodyfit/[profileId]", params: { profileId } });

  // 앉은 사람을 기록으로 추측한다 (카메라 없이). 이번 탑승에서 아직 고르지 않았을 때만 보여 준다.
  const guess =
    guessPending && profiles.data && boardings.data
      ? guessDriver({
          profileIds: profiles.data.map((profile) => profile.id),
          boardings: boardings.data,
          now: openedAt,
        })
      : null;
  const guessed = guess
    ? profiles.data?.find((profile) => profile.id === guess.profileId)
    : undefined;

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
                icon={
                  <IconBadge glyph={profile.name.slice(0, 1)} tone="tint" />
                }
                value={profile.name}
                detail={`${profile.heightCm}cm · ${profile.weightKg}kg`}
                accessibilityLabel={`${profile.name}, 키 ${profile.heightCm}센티미터`}
                onPress={() => openDriver(profile.id)}
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
        right={
          guess && guessed ? (
            <View style={styles.stack}>
              <BodyfitDriverGuess
                key={guessed.id}
                name={guessed.name}
                reason={guess.reason}
                confidence={guess.confidence}
                // 주차(P) 중이고 확률이 충분히 높을 때만 저절로 넘어간다 (S-5). 낮으면 묻기만 한다.
                autoStart={
                  gear === "park" && guess.confidence >= AUTO_START_CONFIDENCE
                }
                // 음성은 Pleos 서버에서 처리될 수 있어, 추측한 운전자가 음성 기능에 동의했을 때만 묻는다.
                askByVoice={
                  canUseVoice &&
                  isPleosAvailable() &&
                  guessed.voiceConsent &&
                  gear === "park"
                }
                onAccept={() => openDriver(guessed.id)}
                onDismiss={() => dispatch(driverGuessDismissed())}
              />
              {drivers}
            </View>
          ) : (
            drivers
          )
        }
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
  stack: { gap: spacing.lg },
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
  skeletonBar: {
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  skeletonName: { width: "40%", height: spacing.lg },
  skeletonDetail: { width: "60%", height: spacing.md },
}));
