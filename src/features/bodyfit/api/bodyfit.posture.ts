import { isDemoBuild } from "@/shared/config/app-variant";

import {
  samplePostureDrives,
  type PostureDrive,
} from "../model/bodyfit-posture";
import { postureDriveSchema } from "../model/bodyfit.schema";

/**
 * 이 운전자의 주행 자세 기록.
 * 주행 중 카메라 관찰이 아직 연결되지 않아 실제 기록은 없다. 시연용 빌드에서는 화면을 보여 주기 위한
 * 예시 기록(sample: true)을 돌려주고, 앱 마켓 빌드에서는 빈 목록이다.
 * 관찰이 연결되면 이 함수만 기기 저장소를 읽게 바꾼다 (화면은 그대로 쓴다).
 */
export async function findPostureDrives(
  profileId: string,
): Promise<PostureDrive[]> {
  if (!isDemoBuild) return [];
  // 저장소에서 읽을 때와 같은 검증을 거친다: 범위 밖 값이 든 기록은 버린다.
  return samplePostureDrives(profileId, Date.now()).flatMap((drive) => {
    const parsed = postureDriveSchema.safeParse(drive);
    return parsed.success ? [parsed.data] : [];
  });
}
