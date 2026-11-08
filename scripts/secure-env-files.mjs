#!/usr/bin/env node
// 프로젝트 루트의 환경 변수 파일(.env*) 권한을 본인만 읽고 쓸 수 있게(600) 바꾼다: `npm run secure:env`
// 파일 내용은 읽지 않고 권한만 바꾼다. Windows는 이 방식의 파일 권한이 없어 건너뛴다.

import { chmodSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

if (process.platform === "win32") {
  console.log("Windows에서는 chmod 권한을 지원하지 않아 건너뜁니다.");
  process.exit(0);
}

const projectDir = process.cwd();
const envFiles = readdirSync(projectDir).filter(
  (name) =>
    name.startsWith(".env") && statSync(path.join(projectDir, name)).isFile(),
);

if (envFiles.length === 0) {
  console.log("환경 변수 파일(.env*)이 없습니다. 먼저 .env.local 을 만드세요.");
  process.exit(0);
}

for (const name of envFiles) {
  const filePath = path.join(projectDir, name);
  const before = (statSync(filePath).mode & 0o777).toString(8);
  chmodSync(filePath, 0o600);
  console.log(`${name}: 권한 ${before} → 600 (본인만 읽기·쓰기)`);
}
