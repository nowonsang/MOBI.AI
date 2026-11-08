import "server-only";

import { z } from "zod";

// 서버 전용 환경 변수의 유일한 진입점. 코드에서 process.env를 직접 읽지 말고 serverEnv를 import 한다.
// 새 변수는 이 스키마에 추가하고, README "환경 변수" 표에 이름과 용도만 기록한다 (값은 절대 기록하지 않는다).
// 값이 없거나 형식이 틀리면 서버가 시작될 때 바로 실패한다. 에러 메시지에는 값이 포함되지 않는다.

function isServerOnlyKey(value: string) {
  if (value.startsWith("sb_secret_")) return true;
  if (!value.startsWith("eyJ")) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(value.split(".")[1] ?? "", "base64url").toString("utf8"),
    );
    return payload?.role !== "anon";
  } catch {
    return true;
  }
}

// NEXT_PUBLIC_ 변수는 빌드 시 브라우저 번들에 그대로 들어간다. 서버 전용 키가 섞여 있으면 시작을 막는다.
const leakedPublicVars = Object.entries(process.env)
  .filter(
    ([name, value]) =>
      name.startsWith("NEXT_PUBLIC_") && value && isServerOnlyKey(value),
  )
  .map(([name]) => name);

if (leakedPublicVars.length > 0) {
  throw new Error(
    `서버 전용 키가 브라우저 노출 변수에 들어 있습니다: ${leakedPublicVars.join(", ")} (즉시 키를 교체하세요)`,
  );
}

const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  SUPABASE_URL: z.url({ protocol: /^https$/ }),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1)
    .refine(isServerOnlyKey, "service_role(또는 sb_secret_) 키가 아닙니다"),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  // 값이 로그에 남지 않도록 변수 이름과 사유만 출력한다.
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(", ");
  throw new Error(`서버 환경 변수 검증 실패 — ${issues}`);
}

export const serverEnv = parsed.data;
