import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { canControlComfort } from "@/shared/config/app-variant";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { IconBadge } from "@/shared/ui/icon-badge";
import { InfoRow } from "@/shared/ui/info-row";
import { StatusView } from "@/shared/ui/status-view";
import { colors, radius, spacing } from "@/shared/ui/theme";

import { useApplyComfort } from "../api/bodyfit.mutations";
import { bodyfitQueries } from "../api/bodyfit.queries";
import { speakQuietly } from "../api/bodyfit.voice";
import { comfortChanges, recommendComfort } from "../model/bodyfit-comfort";
import type { ComfortSettings } from "../model/bodyfit.types";
import { describeBodyfitError } from "./bodyfit-error-copy";

type ComfortKey = keyof ComfortSettings;

// 열선 값은 음수 = 통풍, 0 = 꺼짐, 양수 = 열선 단계 (차량 규약).
const describeSeatHeat = (value: number) =>
  value > 0 ? `열선 ${value}단` : value < 0 ? `통풍 ${-value}단` : "꺼짐";
const describeSteeringHeat = (value: number, max: number | undefined) =>
  value > 0
    ? max === 1
      ? "켬"
      : `${value}단`
    : value < 0
      ? `냉각 ${-value}단`
      : "꺼짐";
const describeTemp = (value: number) => `${Number(value.toFixed(1))}℃`;

const ROWS: { key: ComfortKey; label: string; glyph: string }[] = [
  { key: "seatHeat", label: "시트 열선", glyph: "♨" },
  { key: "steeringHeat", label: "핸들 열선", glyph: "◎" },
  { key: "cabinTarget", label: "실내 온도", glyph: "℃" },
];

/**
 * 운전석 온도 취향: 출발할 때의 열선·공조 설정을 기억해 두었다가, 탈 때 실내 온도가 비슷한 날의 설정으로 맞춘다.
 * 맞추기는 주차(P) 중 화면에서 운전자가 누를 때만 한다.
 */
export function BodyfitComfortCard({
  profileId,
  vehicleConnected,
  parked,
}: {
  profileId: string;
  vehicleConnected: boolean;
  parked: boolean;
}) {
  const records = useQuery(bodyfitQueries.comfortRecords(profileId));
  const comfort = useQuery({
    ...bodyfitQueries.comfort(),
    enabled: vehicleConnected,
  });
  const apply = useApplyComfort();
  const [notice, setNotice] = useState<string | null>(null);

  const cabinNow = comfort.data?.cabinCurrent ?? null;
  const recommendation = records.data
    ? recommendComfort(records.data, cabinNow)
    : null;
  const changes =
    recommendation && comfort.data
      ? comfortChanges(comfort.data, recommendation.settings)
      : {};
  const changeCount = Object.keys(changes).length;

  const describe = (key: ComfortKey, value: number) =>
    key === "seatHeat"
      ? describeSeatHeat(value)
      : key === "steeringHeat"
        ? describeSteeringHeat(value, comfort.data?.steeringHeat?.max)
        : describeTemp(value);

  const applyComfort = () =>
    apply.mutate(changes, {
      onSuccess: () => {
        setNotice("평소 온도로 맞췄어요");
        void speakQuietly("평소 좋아하시는 온도로 맞췄어요");
      },
    });

  const basis = !recommendation
    ? null
    : recommendation.similarCabin && cabinNow !== null
      ? `지금 실내 ${describeTemp(Math.round(cabinNow))}와 비슷한 날의 설정이에요`
      : "최근 출발 기록으로 골랐어요";

  return (
    <Card
      title="내 운전석 온도"
      count={recommendation ? `${recommendation.basedOn}건` : undefined}
    >
      {records.isPending ? (
        <View style={styles.skeleton} accessibilityLabel="불러오는 중" />
      ) : !recommendation ? (
        <AppText variant="secondary" tone="secondary">
          아직 기록이 없어요. 출발할 때의 열선·온도부터 자동으로 기억해요
        </AppText>
      ) : (
        <View style={styles.rows}>
          {basis ? (
            <AppText variant="caption" tone="tertiary">
              {basis}
            </AppText>
          ) : null}
          {ROWS.map(({ key, label, glyph }) => {
            const wanted = recommendation.settings[key];
            if (wanted === undefined) return null;
            const now = comfort.data?.[key]?.value;
            return (
              <InfoRow
                key={key}
                icon={<IconBadge glyph={glyph} />}
                label={label}
                value={describe(key, wanted)}
                detail={
                  now === undefined ? undefined : `지금 ${describe(key, now)}`
                }
              />
            );
          })}
        </View>
      )}

      {canControlComfort && recommendation && vehicleConnected ? (
        <View style={styles.action}>
          <Button
            label={
              changeCount > 0 ? "평소 온도로 맞추기" : "평소 온도와 같아요"
            }
            variant="secondary"
            onPress={applyComfort}
            disabled={!parked || changeCount === 0 || !comfort.data}
            loading={apply.isPending}
            accessibilityHint="시트 열선, 핸들 열선, 실내 온도를 평소 설정으로 바꿔요"
          />
          {!parked ? (
            <AppText variant="caption" tone="tertiary">
              주차(P) 중에만 바꿔요
            </AppText>
          ) : null}
        </View>
      ) : null}

      {notice ? (
        <AppText
          variant="secondary"
          tone="secondary"
          accessibilityLiveRegion="polite"
        >
          {notice}
        </AppText>
      ) : null}
      {apply.error ? (
        <StatusView {...describeBodyfitError(apply.error)} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  rows: { gap: spacing.xs },
  skeleton: {
    height: 160,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceMuted,
  },
  action: { gap: spacing.xs, marginTop: spacing.sm },
});
