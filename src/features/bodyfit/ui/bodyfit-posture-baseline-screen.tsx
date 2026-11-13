import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View, useWindowDimensions } from "react-native";

import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Columns } from "@/shared/ui/columns";
import { Screen } from "@/shared/ui/screen";
import { radius, spacing } from "@/shared/ui/theme";
import { themedStyles } from "@/shared/ui/use-theme";

import { bodyfitQueries } from "../api/bodyfit.queries";
import { BodyfitPostureImage } from "./bodyfit-posture-image";
import { BodyfitPostureWatchToggle } from "./bodyfit-posture-watch-toggle";
import { BodyfitMissingDriver } from "./bodyfit-missing-driver";

// 들어오는 카드(시트 화면 "주행 자세 관찰")와 같은 이름을 쓴다. "출발 자세를 기억"은 설명이 맡는다.
const TITLE = "주행 자세 관찰";

// 출발할 때 기억하는 세 곳. 리포트의 변화 칸(postureChangeTiles)과 같은 말로 부른다.
const WATCHED = ["머리 위치", "어깨", "등 기댄 각도"] as const;

/**
 * 주행 자세 관찰의 첫 화면: 무엇을 기억하고, 주행 중에 무엇을 하는지 알려 준다.
 * 주행 중 카메라 관찰(C-7)을 켜고 끄는 곳이고, 리포트를 여는 곳이다. 기록이 없을 때 리포트는 예시 기록을 보여 준다.
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
    return <BodyfitMissingDriver />;
  }

  const driver = profile.data;

  return (
    <Screen
      title={TITLE}
      description="출발할 때 자세와 주행 중 자세를 비교해요"
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
        stretch
        left={
          <Card fill>
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
        right={<BodyfitPostureWatchToggle driver={driver} fill />}
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
