#!/usr/bin/env node
// 배포 빌드 결과물에 비밀 값이 섞였는지 검사한다: `npm run cf:deploy` 가 업로드 직전에 실행
// OpenNext 로컬 빌드는 .env.local 값을 .open-next/cloudflare/next-env.mjs 에 넣으므로, 업로드 전에 막는다.
// 발견한 값은 앞 4글자만 보여 준다.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const targets = (
  process.argv.length > 2 ? process.argv.slice(2) : [".open-next"]
).map((dir) => path.resolve(dir));

const SECRET_PATTERNS = [
  { name: "Supabase secret 키", pattern: /sb_secret_[A-Za-z0-9_-]{16,}/g },
  {
    name: "JWT (Supabase service_role 등)",
    pattern:
      /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  },
  {
    name: "Postgres 접속 문자열 (비밀번호 포함)",
    pattern: /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@"'`]+@/g,
  },
  { name: "개인키", pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/g },
];

const TEXT_FILE = /\.(m?js|cjs|json|html|css|map|txt|ts)$/;
const MAX_BYTES = 20 * 1024 * 1024;
const mask = (value) => `${value.slice(0, 4)}${"*".repeat(8)}`;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(fullPath);
    else if (TEXT_FILE.test(entry.name)) yield fullPath;
  }
}

const problems = [];
let scanned = 0;

for (const target of targets) {
  try {
    statSync(target);
  } catch {
    console.error(
      `검사 대상이 없습니다: ${path.relative(process.cwd(), target)}`,
    );
    process.exit(1);
  }
  for (const file of walk(target)) {
    if (statSync(file).size > MAX_BYTES) continue;
    scanned += 1;
    const text = readFileSync(file, "utf8");
    for (const { name, pattern } of SECRET_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        problems.push(
          `${path.relative(process.cwd(), file)}: ${name} (${mask(match[0])})`,
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error(
    "\n[보안] 빌드 결과물에 비밀 값이 들어 있습니다. 배포하지 마세요.\n",
  );
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    "\n비밀 값은 번들이 아니라 Cloudflare 대시보드의 Secret 으로 넣어야 합니다. 로컬에서 배포하지 말고 Workers Builds(Git 연동)로 배포하세요.\n",
  );
  process.exit(1);
}

console.log(`빌드 결과물 비밀 값 검사 통과 (${scanned}개 파일)`);
