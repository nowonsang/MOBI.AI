import "server-only";

import { z } from "zod";

// 서버 전용 환경 변수의 유일한 진입점. 코드에서 process.env를 직접 읽지 말고 serverEnv를 import 한다.
// 새 변수는 이 스키마에 추가하고, README "환경 변수" 표에 이름과 용도만 기록한다 (값은 절대 기록하지 않는다).
// 값이 없거나 형식이 틀리면 서버가 시작될 때 바로 실패한다.
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export const serverEnv = serverEnvSchema.parse(process.env);
