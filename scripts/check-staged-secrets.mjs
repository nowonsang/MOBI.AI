#!/usr/bin/env node
// git pre-commit 훅에서 실행: 커밋하려는 변경에 비밀 파일·키가 섞여 있으면 커밋을 막는다.
// 이 저장소는 GitHub에 공개되어 있으므로 한 번이라도 푸시된 키는 유출된 것으로 간주해야 한다.
// 발견한 값은 앞 4글자만 보여 주고 나머지는 가린다.

import { execFileSync } from "node:child_process";
import path from "node:path";

const git = (args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

// 커밋하면 안 되는 파일 (이름 기준)
const FORBIDDEN_FILES = [
  /^\.env/i,
  /^\.dev\.vars/i, // wrangler 로컬 비밀 값
  /\.(pem|key|p12|pfx|jks|keystore)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)/i,
  /^\.(npmrc|netrc|pgpass)$/i,
  /^credentials(\.json)?$/i,
  /service[-_]?account.*\.json$/i,
  /^settings\.local\.json$/i,
];

// 커밋하면 안 되는 값 (내용 기준)
const SECRET_PATTERNS = [
  { name: "Supabase secret 키", pattern: /sb_secret_[A-Za-z0-9_-]{16,}/g },
  {
    name: "JWT (Supabase anon/service_role 키 등)",
    pattern:
      /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  },
  {
    name: "Supabase 프로젝트 URL (env로 관리)",
    pattern: /https:\/\/[a-z0-9]{20}\.supabase\.co/g,
  },
  {
    name: "Postgres 접속 문자열 (비밀번호 포함)",
    pattern: /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@]+@/g,
  },
  { name: "개인키", pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g },
  {
    name: "GitHub 토큰",
    pattern:
      /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/g,
  },
  {
    name: "OpenAI/Anthropic 키",
    pattern: /sk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}/g,
  },
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g },
  { name: "Google API 키", pattern: /AIza[0-9A-Za-z_-]{35}/g },
  { name: "Stripe 키", pattern: /(?:sk|rk)_live_[0-9A-Za-z]{20,}/g },
  { name: "Slack 토큰", pattern: /xox[abprs]-[A-Za-z0-9-]{10,}/g },
];

const mask = (value) => `${value.slice(0, 4)}${"*".repeat(8)}`;

const problems = [];

const stagedFiles = git([
  "diff",
  "--cached",
  "--name-only",
  "--diff-filter=ACMR",
  "-z",
])
  .split("\0")
  .filter(Boolean);

for (const file of stagedFiles) {
  if (FORBIDDEN_FILES.some((pattern) => pattern.test(path.basename(file)))) {
    problems.push(`${file}: 비밀 파일은 커밋할 수 없습니다`);
  }
}

// 추가된 줄만 검사한다. (-U0: 문맥 줄 제외)
let currentFile = null;
let lineNumber = 0;
for (const line of git([
  "diff",
  "--cached",
  "-U0",
  "--no-color",
  "--diff-filter=ACMR",
]).split("\n")) {
  if (line.startsWith("+++ ")) {
    currentFile = line.slice(4).replace(/^b\//, "");
    continue;
  }
  const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
  if (hunk) {
    lineNumber = Number(hunk[1]);
    continue;
  }
  if (!line.startsWith("+") || line.startsWith("+++")) continue;

  for (const { name, pattern } of SECRET_PATTERNS) {
    for (const match of line.matchAll(pattern)) {
      problems.push(
        `${currentFile}:${lineNumber}: ${name} 발견 (${mask(match[0])})`,
      );
    }
  }
  lineNumber += 1;
}

if (problems.length > 0) {
  console.error(
    "\n[보안] 커밋이 차단되었습니다. 비밀 값은 .env.local 에만 두세요.\n",
  );
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    "\n실제 키가 이미 다른 곳(채팅, 로그, 원격 저장소)에 노출되었다면 Supabase Dashboard에서 키를 교체하세요.\n",
  );
  process.exit(1);
}
