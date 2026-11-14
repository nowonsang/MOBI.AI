import { useQuery } from "@tanstack/react-query";
import { useIsFocused, useRouter } from "expo-router";
import { Fragment, useState } from "react";
import { Pressable, View } from "react-native";

import { useAppDispatch, useAppSelector } from "@/core/store/hooks";
import { canUseVoice } from "@/shared/config/app-variant";
import { isPleosAvailable } from "@/shared/pleos/pleos";
import { useGear } from "@/shared/pleos/use-gear";
import { AppText } from "@/shared/ui/app-text";
import { Card } from "@/shared/ui/card";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { Divider } from "@/shared/ui/divider";
import { IconBadge } from "@/shared/ui/icon-badge";
import { InfoRow } from "@/shared/ui/info-row";
import { Screen } from "@/shared/ui/screen";
import { StatusView } from "@/shared/ui/status-view";
import { radius, sizes, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { useDeleteBodyProfile } from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { transferReadMode } from "../api/bodyfit.transfer";
import { AUTO_START_CONFIDENCE, guessDriver } from "../model/bodyfit-identify";
import {
  driverGuessDismissed,
  selectDriverGuessPending,
} from "../model/bodyfit-session.slice";
import { BodyfitDriverGuess } from "./bodyfit-driver-guess";
import { describeBodyfitError } from "./bodyfit-error-copy";

// 탑승 단계 (A-1·A-2): 운전자를 고르면 바로 맞춤 자세로 간다.
export function BodyfitDriverListScreen() {
  const styles = useStyles();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const profiles = useQuery(bodyfitQueries.profiles());
  const boardings = useQuery(bodyfitQueries.boardings());
  const guessPending = useAppSelector(selectDriverGuessPending);
  const gear = useGear();
  // 다른 화면이 이 목록을 덮고 있으면 추측한 운전자로 넘어가지 않는다.
  // 앱이 다시 켜지며 뜬 주행 후 질문(다른 운전자의 것일 수 있다)을 추측한 운전자의 화면이 덮어 버린다.
  const focused = useIsFocused();
  // 화면을 연 시각 기준으로 한 번만 추측한다 (렌더마다 시각이 바뀌어 추측이 흔들리지 않게).
  const [openedAt] = useState(() => Date.now());
  const goToNew = () => router.push("/bodyfit/new");
  // 다른 차에서 쓰던 프로필을 QR 로 가져오기 (A-7). 쓸 수 없는 빌드·기기에서는 행을 숨긴다.
  const [canImport] = useState(() => transferReadMode() !== null);
  const goToImport = () => router.push("/bodyfit/import");
  const openDriver = (profileId: string) =>
    router.push({ pathname: "/bodyfit/[profileId]", params: { profileId } });
  // 운전자 지우기: 추가하기와 같은 곳에서 한다. "편집"을 눌러야 지우기 버튼이 보이고, 확인 창을 거친 뒤에만 지운다.
  const remove = useDeleteBodyProfile();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(
    null,
  );
  const deleteDriver = () => {
    if (!removing) return;
    remove.mutate(removing.id);
    setRemoving(null);
    // 마지막 운전자를 지우면 빈 화면이 되니 편집도 끝낸다.
    if ((profiles.data?.length ?? 0) <= 1) setEditing(false);
  };

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
    <View style={styles.stack}>
      <StatusView
        title="아직 등록된 운전자가 없어요"
        description="이름, 키, 몸무게만 있으면 돼요"
        action={{ label: "운전자 등록하기", onPress: goToNew }}
      />
      {/* 등록이 주 행동이다. 가져오기는 다른 차에서 쓰던 사람만 쓰는 길이라 아래에 조용한 행으로 둔다. */}
      {canImport ? (
        <Card>
          <InfoRow
            value="QR 로 가져오기"
            valueTone="accent"
            detail="다른 차에서 쓰던 내 자세를 가져와요"
            onPress={goToImport}
          />
        </Card>
      ) : null}
    </View>
  ) : (
    <Card
      title="운전자"
      count={`${profiles.data.length}명`}
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={editing ? "편집 끝내기" : "운전자 편집"}
          onPress={() => setEditing((on) => !on)}
          style={({ pressed }) => [
            styles.textButton,
            pressed && styles.pressed,
          ]}
        >
          <AppText variant="secondary" tone="accent" style={styles.strong}>
            {editing ? "완료" : "편집"}
          </AppText>
        </Pressable>
      }
    >
      <View>
        {profiles.data.map((profile) => (
          <Fragment key={profile.id}>
            <View style={[styles.row, editing && styles.editRow]}>
              <View style={styles.rowMain}>
                <InfoRow
                  icon={
                    <IconBadge glyph={profile.name.slice(0, 1)} tone="tint" />
                  }
                  value={profile.name}
                  detail={`${profile.heightCm}cm · ${profile.weightKg}kg`}
                  accessibilityLabel={`${profile.name}, 키 ${profile.heightCm}센티미터`}
                  // 편집 중에는 행을 눌러도 화면을 옮기지 않는다 (지우기 버튼과 헷갈리지 않게).
                  onPress={editing ? undefined : () => openDriver(profile.id)}
                />
              </View>
              {editing ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${profile.name} 지우기`}
                  accessibilityHint="체형 정보와 자세 기록을 모두 지워요"
                  disabled={remove.isPending}
                  onPress={() =>
                    setRemoving({ id: profile.id, name: profile.name })
                  }
                  style={({ pressed }) => [
                    styles.textButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppText
                    variant="secondary"
                    tone="danger"
                    style={styles.strong}
                  >
                    지우기
                  </AppText>
                </Pressable>
              ) : null}
            </View>
            <Divider />
          </Fragment>
        ))}
        {/* 운전자 행과 같은 모양으로 목록 끝에 둔다. 고르는 것이 이 화면의 주 행동이라 주 CTA 로 키우지 않는다.
            편집 중에는 지우기만 하도록 숨긴다. */}
        {editing ? null : (
          <View style={styles.row}>
            <InfoRow
              icon={<IconBadge glyph="+" />}
              value="운전자 추가하기"
              valueTone="accent"
              onPress={goToNew}
            />
          </View>
        )}
        {canImport && !editing ? (
          <>
            <Divider />
            <View style={styles.row}>
              <InfoRow
                value="QR 로 가져오기"
                valueTone="accent"
                detail="다른 차에서 쓰던 내 자세를 가져와요"
                onPress={goToImport}
              />
            </View>
          </>
        ) : null}
      </View>
    </Card>
  );

  // 첫 화면은 운전자를 고르는 한 가지 일만 한다. 꾸밈용 그림 칸 없이 목록을 가운데 한 단으로 둔다.
  return (
    <Screen title="누가 운전하나요?" back={false} width="narrow">
      <ConfirmDialog
        visible={removing !== null}
        title={`${removing?.name ?? ""}님의 정보를 지울까요?`}
        description="체형 정보와 자세 기록이 모두 지워지고 되돌릴 수 없어요"
        confirmLabel="지우기"
        onConfirm={deleteDriver}
        onCancel={() => setRemoving(null)}
      />
      {remove.isError ? (
        <StatusView {...describeBodyfitError(remove.error)} />
      ) : null}
      {guess && guessed ? (
        <View style={styles.stack}>
          <BodyfitDriverGuess
            key={guessed.id}
            name={guessed.name}
            reason={guess.reason}
            confidence={guess.confidence}
            // 주차(P) 중이고 확률이 충분히 높을 때만 저절로 넘어간다 (S-5). 낮으면 묻기만 한다.
            autoStart={
              focused &&
              gear === "park" &&
              guess.confidence >= AUTO_START_CONFIDENCE
            }
            // 음성은 Pleos 서버에서 처리될 수 있어, 추측한 운전자가 음성 기능에 동의했을 때만 묻는다.
            askByVoice={
              canUseVoice &&
              isPleosAvailable() &&
              guessed.voiceConsent &&
              focused &&
              gear === "park"
            }
            onAccept={() => openDriver(guessed.id)}
            onDismiss={() => dispatch(driverGuessDismissed())}
          />
          {drivers}
        </View>
      ) : (
        drivers
      )}
    </Screen>
  );
}

const useStyles = themedStyles((colors) => ({
  stack: { gap: spacing.lg },
  // 행 위아래 여백으로 터치 대상 사이 24dp 를 확보한다 (구분선 포함).
  row: { paddingVertical: spacing.xs },
  editRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  rowMain: { flex: 1 },
  strong: { fontWeight: "700" },
  // 카드 제목 옆 "편집"·행 끝 "지우기" 같은 글자 버튼. 터치 대상 76dp.
  textButton: {
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: radius.control,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
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
