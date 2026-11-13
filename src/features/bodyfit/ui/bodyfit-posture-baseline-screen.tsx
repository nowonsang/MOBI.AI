import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View, useWindowDimensions } from "react-native";

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

import { bodyfitQueries } from "../api/bodyfit.queries";
import { BodyfitPostureImage } from "./bodyfit-posture-image";

const TITLE = "출발 자세 기억";

// 출발할 때 기억하는 세 곳. 리포트의 변화 칸(postureChangeTiles)과 같은 말로 부른다.
const WATCHED = ["머리 위치", "어깨", "등 기댄 각도"] as const;

// 주행 중 자세 관찰이 하는 일. 주행 중에는 아무것도 묻지 않는다 (S-5).
const STEPS = [
  { when: "출발할 때", what: "지금 자세를 기준으로 기억해요" },
  { when: "주행 중", what: "아무것도 묻지 않고 지켜보기만 해요" },
  { when: "주차하면", what: "달라진 점을 알려 드려요" },
] as const;

/**
 * 주행 자세 관찰의 첫 화면: 무엇을 기억하고, 주행 중에 무엇을 하는지 알려 준다.
 * 주행 중 카메라 관찰은 아직 연결되지 않았다. 이 화면은 그 사실을 알리고, 기록(지금은 예시)을 여는 곳이다.
 */
export function BodyfitPostureBaselineScreen({
  profileId,
}: {
  profileId: string;
}) {
  const styles = useStyles();
  const router = useRouter();
  const profile = useQuery(bodyfitQueries.profile(profileId));
  // 한 화면에 들어오게 그림은 창 높이에 맞춰 줄인다.
  const pictureHeight = useWindowDimensions().height >= 1000 ? 320 : 220;

  if (profile.isPending) {
    return (
      <Screen title={TITLE}>
        {/* 실제 화면과 같은 2단 모양의 스켈레톤 */}
        <Columns
          left={
            <View style={styles.skeleton} accessibilityLabel="불러오는 중" />
          }
          right={<View style={styles.skeletonTall} />}
        />
      </Screen>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <Screen title="운전자 정보를 찾지 못했어요" width="narrow">
        <StatusView
          title="운전자 정보가 없어요"
          description="목록에서 운전자를 다시 골라 주세요"
          action={{
            label: "운전자 목록으로",
            onPress: () => router.replace("/bodyfit"),
          }}
        />
      </Screen>
    );
  }

  const driver = profile.data;

  return (
    <Screen
      title={TITLE}
      description={`${driver.name}님이 출발할 때의 자세를 기준으로, 주행 중 달라진 점을 알려 드려요`}
      footer={
        <Button
          label="최근 리포트 보기"
          onPress={() =>
            router.push({
              pathname: "/bodyfit/[profileId]/posture/report",
              params: { profileId: driver.id },
            })
          }
        />
      }
    >
      <Columns
        left={
          <Card>
            <BodyfitPostureImage
              pose="upright"
              height={pictureHeight}
              label="머리, 어깨, 등에 점을 찍은 출발 자세 그림"
            />
            <View style={styles.watched}>
              {WATCHED.map((name) => (
                <View key={name} style={styles.watchedItem}>
                  <View style={styles.dot} />
                  <AppText variant="caption" tone="secondary">
                    {name}
                  </AppText>
                </View>
              ))}
            </View>
          </Card>
        }
        right={
          <>
            <Card title="주행 중에는 이렇게 해요">
              <View>
                {STEPS.map((step, index) => (
                  <View key={step.when}>
                    {index > 0 ? <Divider /> : null}
                    <InfoRow
                      icon={<IconBadge glyph={`${index + 1}`} tone="tint" />}
                      label={step.when}
                      value={step.what}
                    />
                  </View>
                ))}
              </View>
            </Card>
            <Card>
              <InfoRow
                icon={<IconBadge glyph="…" tone="muted" />}
                label="주행 중 자세 관찰"
                value="아직 연결되지 않았어요"
                detail="카메라 관찰이 연결되면 여기에서 켜고 끌 수 있어요. 지금 리포트는 예시 기록이에요"
              />
            </Card>
          </>
        }
      />
    </Screen>
  );
}

const useStyles = themedStyles((colors) => ({
  skeleton: {
    height: 420,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  skeletonTall: {
    height: 480,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  watched: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  watchedItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  // 그림 속 세 점과 같은 색
  dot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
}));
