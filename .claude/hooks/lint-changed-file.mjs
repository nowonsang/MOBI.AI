#!/usr/bin/env node
// PostToolUse 훅: AI가 수정한 파일을 즉시 ESLint로 검사해 아키텍처·코드 규칙 위반을 AI에게 돌려준다.
// 위반이 있으면 exit 2 → stderr가 AI에게 전달되어 바로 고치게 한다. (파일 수정 자체는 이미 끝난 상태)
// 린트는 보조 장치이므로 ESLint를 실행할 수 없는 환경에서는 조용히 넘어간다.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const LINTABLE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

let filePath;
try {
  filePath = JSON.parse(readFileSync(0, "utf8"))?.tool_input?.file_path;
} catch {
  process.exit(0);
}

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const eslintEntry = path.join(projectDir, "node_modules", "eslint", "bin", "eslint.js");

if (
  typeof filePath !== "string" ||
  !LINTABLE.test(filePath) ||
  !existsSync(filePath) ||
  !existsSync(eslintEntry)
) {
  process.exit(0);
}

const relativePath = path.relative(projectDir, path.resolve(filePath));
// 프로젝트 밖 파일과 node_modules는 검사하지 않는다.
if (relativePath.startsWith("..") || relativePath.includes("node_modules")) {
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [eslintEntry, "--no-warn-ignored", relativePath],
  { cwd: projectDir, encoding: "utf8" },
);

if (result.status === 1) {
  process.stderr.write(
    "ESLint 규칙 위반이 있습니다. 아래 문제를 수정하세요. " +
      "(아키텍처 규칙: .claude/skills/project-architecture/SKILL.md)\n" +
      result.stdout,
  );
  process.exit(2);
}

process.exit(0);
