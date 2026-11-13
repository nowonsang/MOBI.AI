import { isDemoBuild } from "@/shared/config/app-variant";

import {
  samplePostureDrives,
  type PostureDrive,
} from "../model/bodyfit-posture";
import { postureDriveSchema } from "../model/bodyfit.schema";
import { findBodyProfile, findStoredPostureDrives } from "./bodyfit.storage";

/**
 * 이 운전자의 주행 자세 기록 (최근 것부터).
 * 주행 중 카메라 관찰(C-7)을 켜고 달리면 주차할 때 기기 저장소에 쌓인다 (useAnalyzeDrivePosture).
 * 아직 기록이 없으면 시연용 빌드에서는 화면을 보여 주기 위한 예시 기록(sample: true)을 돌려준다.
 * 다만 관찰을 켠 운전자와 앱 마켓 빌드에서는 빈 목록이다.
 */
export async function findPostureDrives(
  profileId: string,
): Promise<PostureDrive[]> {
  const stored = await findStoredPostureDrives(profileId);
  if (stored.length > 0 || !isDemoBuild) return stored;
  // 관찰을 켠 운전자에게는 예시를 보여 주지 않는다: 첫 주행 뒤 실제 기록이 생긴다.
  if ((await findBodyProfile(profileId))?.postureConsent) return [];
  // 저장소에서 읽을 때와 같은 검증을 거친다: 범위 밖 값이 든 기록은 버린다.
  return samplePostureDrives(profileId, Date.now()).flatMap((drive) => {
    const parsed = postureDriveSchema.safeParse(drive);
    return parsed.success ? [parsed.data] : [];
  });
}
