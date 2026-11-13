import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { AppText } from "@/shared/ui/app-text";
import { InfoRow } from "@/shared/ui/info-row";
import { Card } from "@/shared/ui/card";

import { bodyfitQueries } from "../api/bodyfit.queries";
import {
  latestPostureDrive,
  summarizePostureDrive,
} from "../model/bodyfit-posture";
import type { BodyProfile } from "../model/bodyfit.types";
import { postureHeadline } from "./bodyfit-posture-copy";
import { BodyfitPostureTimeline } from "./bodyfit-posture-timeline";

/**
 * 주행 후 질문 화면에서 주행 자세 관찰(D-6 화면)로 이어 주는 카드.
 * - 관찰을 안 켠 운전자: 켜는 첫 화면으로
 * - 주행이 끝나 뜬 질문이고 이번 주행 기록이 있으면: 결과 한 줄과 유지·쏠림 막대를 보여 주고, 누르면 그 주행의 리포트로
 * - 주행이 끝나 뜬 질문인데 기록이 없으면(카메라가 사람을 못 봄): 살펴보지 못했다고 알린다
 * - 운전자가 직접 연 화면이면: 가장 최근 리포트로
 */
export function BodyfitPostureLink({
  driver,
  afterDrive,
  postureAt,
  compact = false,
}: {
  driver: BodyProfile;
  /** 주행이 끝나 자동으로 뜬 질문인지 */
  afterDrive: boolean;
  /** 이번 주행을 카메라로 살펴 남긴 기록의 출발 시각. 없으면 null */
  postureAt: number | null;
  /** 다른 내용 아래 덧붙일 때: 리포트가 있으면 한 줄로만, 없으면 아무것도 그리지 않는다 */
  compact?: boolean;
}) {
  const router = useRouter();
  const drives = useQuery({
    ...bodyfitQueries.postureDrives(driver.id),
    enabled: driver.postureConsent,
  });
  const all = drives.data ?? [];
  const latest = latestPostureDrive(all);
  const chosen =
    postureAt === null
      ? null
      : (all.find((item) => item.startedAt === postureAt) ?? null);

  if (compact) {
    const drive = latest;
    if (!driver.postureConsent || !drive) return null;
    const headline = postureHeadline(summarizePostureDrive(drive));
    return (
      <InfoRow
        value={`주행 자세 · ${headline}`}
        onPress={() =>
          router.push({
            pathname: "/bodyfit/[profileId]/posture/report",
            params: {
              profileId: driver.id,
              startedAt: String(drive.startedAt),
            },
          })
        }
        accessibilityLabel={`${headline}. 눌러서 주행 자세 리포트를 봐요`}
      />
    );
  }

  if (!driver.postureConsent) {
    return (
      <Card
        title="주행 자세 관찰 (선택)"
        onPress={() =>
          router.push({
            pathname: "/bodyfit/[profileId]/posture",
            params: { profileId: driver.id },
          })
        }
        accessibilityLabel="주행 자세 관찰. 주행 중 카메라로 자세 변화를 살펴보는 기능을 켜요"
      >
        <AppText variant="secondary" tone="secondary">
          주행 중 카메라로 자세가 언제부터 흐트러지는지 살펴볼 수 있어요
        </AppText>
      </Card>
    );
  }

  if (driver.postureConsent && drives.isPending) {
    return <Card title={afterDrive ? "이번 주행 자세" : "주행 자세 리포트"} />;
  }

  if (afterDrive && postureAt === null) {
    return (
      <Card title="이번 주행 자세">
        <AppText variant="secondary" tone="secondary">
          이번 주행은 자세를 살펴보지 못했어요. 카메라에 머리와 어깨가 보이는지
          확인해 주세요
        </AppText>
      </Card>
    );
  }

  const drive = postureAt === null ? latest : chosen;
  if (!drive) {
    return (
      <Card title="주행 자세 리포트">
        <AppText variant="secondary" tone="secondary">
          켜져 있어요. 한 번 주행하고 주차하면 리포트가 생겨요
        </AppText>
      </Card>
    );
  }
  const report = summarizePostureDrive(drive);

  return (
    <Card
      title={afterDrive ? "이번 주행 자세" : "주행 자세 리포트"}
      onPress={() =>
        router.push({
          pathname: "/bodyfit/[profileId]/posture/report",
          params: { profileId: driver.id, startedAt: String(drive.startedAt) },
        })
      }
      accessibilityLabel={`${postureHeadline(report)}. 눌러서 주행 자세 리포트를 봐요`}
    >
      {/* 누르기 전에 결과를 한눈에: 리포트와 같은 한 줄과 막대 */}
      <AppText variant="bodyStrong">{postureHeadline(report)}</AppText>
      <BodyfitPostureTimeline
        heldMin={report.heldMin}
        driftMin={report.driftMin}
        scaleMin={report.durationMin}
      />
    </Card>
  );
}
