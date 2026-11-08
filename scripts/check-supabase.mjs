#!/usr/bin/env node
// Supabase 연결 점검 스크립트: `npm run check:supabase`
// 키 값은 절대 출력하지 않는다. 변수 이름, 키 종류, HTTP 상태 코드만 출력한다.
// 출력 직전에 env 파일에서 읽은 모든 값을 [REDACTED]로 치환하는 안전장치를 둔다.

import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";

const SCHEMA = "mobi_ai";
const projectDir = process.cwd();

// Next.js와 같은 규칙(.env.local 우선)으로 불러온다. 파일 경로 로그는 끈다.
const { parsedEnv = {} } = nextEnv.loadEnvConfig(projectDir, true, {
  info: () => {},
  error: () => {},
});

const secretValues = Object.values(parsedEnv).filter(
  (value) => typeof value === "string" && value.length >= 8,
);

function redact(text) {
  let output = String(text);
  for (const value of secretValues)
    output = output.split(value).join("[REDACTED]");
  return output;
}

let failures = 0;
const log = (mark, message) => console.log(redact(`${mark} ${message}`));
const pass = (message) => log("PASS", message);
const warn = (message) => log("WARN", message);
const fail = (message) => {
  failures += 1;
  log("FAIL", message);
};

function pick(names) {
  const name = names.find((candidate) => process.env[candidate]);
  return name ? { name, value: process.env[name] } : null;
}

function describeKey(value) {
  if (value.startsWith("sb_publishable_"))
    return { kind: "publishable", secret: false };
  if (value.startsWith("sb_secret_")) return { kind: "secret", secret: true };
  if (value.startsWith("eyJ")) {
    try {
      const payload = JSON.parse(
        Buffer.from(value.split(".")[1], "base64url").toString("utf8"),
      );
      const role = payload?.role;
      return { kind: `legacy JWT (role=${role})`, secret: role !== "anon" };
    } catch {
      return { kind: "형식을 알 수 없는 JWT", secret: true };
    }
  }
  return { kind: "알 수 없는 형식", secret: true };
}

async function request(url, apiKey, headers = {}) {
  try {
    // 새 형식 키(sb_*)는 apikey 헤더로만 보내고, Bearer 헤더에는 legacy JWT만 넣는다.
    const bearer = apiKey.startsWith("eyJ")
      ? { Authorization: `Bearer ${apiKey}` }
      : {};
    const response = await fetch(url, {
      headers: { apikey: apiKey, ...bearer, ...headers },
      signal: AbortSignal.timeout(10_000),
    });
    let body = null;
    try {
      body = await response.json();
    } catch {
      // 본문이 JSON이 아니면 상태 코드만 사용한다.
    }
    return { status: response.status, code: body?.code ?? null };
  } catch (error) {
    return {
      status: 0,
      code: error?.cause?.code ?? error?.name ?? "NETWORK_ERROR",
    };
  }
}

console.log("== 1. 환경 변수 (이름만 표시) ==");
const relatedNames = Object.keys(parsedEnv).filter((name) =>
  /SUPABASE|DATABASE_URL|POSTGRES/i.test(name),
);
console.log(
  `env 파일에서 찾은 Supabase 관련 변수: ${relatedNames.join(", ") || "(없음)"}`,
);

const urlVar = pick(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);
const publicKeyVar = pick([
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
]);
const secretKeyVar = pick([
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
]);

let supabaseUrl = null;
if (!urlVar) {
  fail("Supabase URL 변수가 없습니다 (NEXT_PUBLIC_SUPABASE_URL)");
} else {
  try {
    const parsed = new URL(urlVar.value);
    secretValues.push(parsed.host);
    if (parsed.protocol === "https:" && parsed.host.endsWith(".supabase.co")) {
      pass(`${urlVar.name}: https://<project-ref>.supabase.co 형식`);
    } else {
      warn(
        `${urlVar.name}: supabase.co 도메인이 아닙니다 (셀프 호스팅이면 무시)`,
      );
    }
    supabaseUrl = parsed.origin;
  } catch {
    fail(`${urlVar.name}: URL 형식이 아닙니다`);
  }
}

if (!publicKeyVar) {
  warn(
    "공개용 키(anon/publishable)가 없습니다. RLS를 따르는 일반 조회에는 공개용 키 사용을 권장합니다",
  );
} else {
  const { kind, secret } = describeKey(publicKeyVar.value);
  if (secret)
    fail(
      `${publicKeyVar.name}: 공개용 자리에 서버 전용 키(${kind})가 들어 있습니다`,
    );
  else pass(`${publicKeyVar.name}: ${kind}`);
}

if (!secretKeyVar) {
  warn(
    "서버 전용 키가 없습니다 (SUPABASE_SECRET_KEY 등). RLS를 우회하는 관리 작업이 필요할 때만 추가하세요",
  );
} else {
  const { kind, secret } = describeKey(secretKeyVar.value);
  if (secretKeyVar.name.startsWith("NEXT_PUBLIC_")) {
    fail(`${secretKeyVar.name}: 서버 전용 키에 NEXT_PUBLIC_ 접두어가 있습니다`);
  } else if (!secret) {
    warn(
      `${secretKeyVar.name}: 서버 전용 변수에 공개용 키(${kind})가 들어 있습니다`,
    );
  } else {
    pass(`${secretKeyVar.name}: ${kind} (서버 전용)`);
  }
}

// NEXT_PUBLIC_ 변수는 브라우저 번들에 그대로 들어가므로 서버 전용 키가 섞이면 즉시 유출이다.
for (const name of Object.keys(parsedEnv).filter((key) =>
  key.startsWith("NEXT_PUBLIC_"),
)) {
  const value = parsedEnv[name];
  if (
    value.startsWith("sb_secret_") ||
    (value.startsWith("eyJ") && describeKey(value).secret)
  ) {
    fail(
      `${name}: 브라우저에 노출되는 변수에 서버 전용 키가 들어 있습니다 (즉시 키 교체 필요)`,
    );
  }
}

console.log("\n== 2. 키 파일 보호 상태 ==");
for (const file of [".env.local", ".env"]) {
  const filePath = path.join(projectDir, file);
  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    continue;
  }
  let ignored = false;
  let tracked = false;
  try {
    execFileSync("git", ["check-ignore", "-q", file], { cwd: projectDir });
    ignored = true;
  } catch {
    // check-ignore는 무시 대상이 아니면 exit 1
  }
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", file], {
      cwd: projectDir,
      stdio: "ignore",
    });
    tracked = true;
  } catch {
    // 추적 중이 아니면 exit 1
  }
  if (tracked)
    fail(`${file}: git에 커밋되어 있습니다 (키 교체 + 히스토리 정리 필요)`);
  else if (!ignored) fail(`${file}: .gitignore 대상이 아닙니다`);
  else pass(`${file}: gitignore 적용, git 추적 안 됨`);

  // 키 파일은 본인만 읽을 수 있어야 한다. Windows는 chmod 권한 체계가 없어 검사하지 않는다.
  const mode = (stats.mode & 0o777).toString(8);
  if (process.platform === "win32") {
    warn(`${file}: Windows에서는 권한을 검사하지 않습니다`);
  } else if (stats.mode & 0o077) {
    fail(
      `${file}: 권한 ${mode} — 다른 사용자도 읽을 수 있습니다 (npm run secure:env 로 600으로 변경)`,
    );
  } else {
    pass(`${file}: 권한 ${mode} (본인만 읽기 가능)`);
  }
}

const probeKeyVar = publicKeyVar ?? secretKeyVar;

if (supabaseUrl && publicKeyVar) {
  console.log("\n== 3. Supabase 연결 ==");
  const health = await request(
    `${supabaseUrl}/auth/v1/health`,
    publicKeyVar.value,
  );
  if (health.status === 200) pass(`Auth API 응답 200 (공개용 키 유효)`);
  else fail(`Auth API 응답 ${health.status} ${health.code ?? ""}`.trim());
} else if (supabaseUrl) {
  console.log("\n== 3. Supabase 연결 ==");
}

if (supabaseUrl && probeKeyVar) {
  const probe = await request(
    `${supabaseUrl}/rest/v1/__schema_probe__?limit=0`,
    probeKeyVar.value,
    {
      "Accept-Profile": SCHEMA,
    },
  );
  // 존재하지 않는 테이블을 조회해 스키마 노출 여부만 판별한다.
  if (probe.code === "PGRST106") {
    fail(
      `스키마 ${SCHEMA}: Data API에 노출되어 있지 않습니다 (마이그레이션 실행 후 Dashboard → Data API → Exposed schemas 에 추가)`,
    );
  } else if (probe.code === "PGRST205" || probe.status === 404) {
    pass(`스키마 ${SCHEMA}: Data API에 노출됨`);
  } else {
    warn(
      `스키마 ${SCHEMA}: 확인 불가 (응답 ${probe.status} ${probe.code ?? ""})`.trim(),
    );
  }

  if (secretKeyVar && describeKey(secretKeyVar.value).secret) {
    const adminHealth = await request(
      `${supabaseUrl}/auth/v1/health`,
      secretKeyVar.value,
    );
    if (adminHealth.status === 200)
      pass(`서버 전용 키로 Auth API 응답 200 (서버 전용 키 유효)`);
    else
      fail(
        `서버 전용 키 응답 ${adminHealth.status} ${adminHealth.code ?? ""}`.trim(),
      );

    // 앱과 같은 클라이언트(supabase-js)·같은 옵션으로 접속해, 새 형식 키(sb_secret_)도 실제 조회 경로에서 인증되는지 확인한다.
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(supabaseUrl, secretKeyVar.value, {
      db: { schema: SCHEMA },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { error, status } = await client
      .from("__schema_probe__")
      .select("*")
      .limit(0);
    if (error?.code === "PGRST205" || status === 404) {
      pass(`앱 클라이언트(supabase-js)로 서버 키 인증 + ${SCHEMA} 접근 정상`);
    } else if (error?.code === "PGRST106") {
      fail(
        `앱 클라이언트(supabase-js): ${SCHEMA} 스키마가 노출되어 있지 않습니다`,
      );
    } else {
      fail(
        `앱 클라이언트(supabase-js) 접근 실패 (응답 ${status} ${error?.code ?? ""})`.trim(),
      );
    }
  }
}

console.log(`\n${failures === 0 ? "결과: 통과" : `결과: 실패 ${failures}건`}`);
process.exit(failures === 0 ? 0 : 1);
