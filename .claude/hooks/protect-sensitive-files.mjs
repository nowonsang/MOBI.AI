#!/usr/bin/env node
// PreToolUse 훅: AI가 민감 파일(.env, 개인키, 인증 정보 등)에 접근하거나 보호 설정을 끄지 못하게 막는다.
// 차단 시 exit 2 → Claude Code가 도구 실행을 취소하고 stderr 메시지를 AI에게 전달한다.
// settings.json의 permissions.deny와 함께 쓰는 이중 방어선이다. (deny는 파일 도구, 이 훅은 Bash까지 검사)

import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";

// 파일 이름(basename) 기준 차단 패턴
const SENSITIVE_NAMES = [
  /^\.env/i, // .env, .env.local, .env.production, .envrc ...
  /\.(pem|key|p12|pfx|jks|keystore)$/i, // 개인키·인증서 번들
  /^id_(rsa|dsa|ecdsa|ed25519)/i, // SSH 개인키
  /^\.(npmrc|netrc|pgpass)$/i, // 토큰이 들어가는 설정 파일
  /^credentials(\.json)?$/i,
  /^secrets?\.(json|ya?ml|toml)$/i,
  /service[-_]?account.*\.json$/i, // GCP 서비스 계정 키
  /^\.(\*|\?+\*?|e\*|en\*)$/, // .* 처럼 dotfile 전체(= .env 포함)를 가리키는 글롭
];

// 경로 안에 포함되면 차단하는 디렉터리
const SENSITIVE_DIRS = /(^|\/)(\.ssh|\.aws|\.gnupg|secrets)(\/|$)/i;

// 글롭 패턴 속 .env 참조 (예: **/.env*, *.env)
const ENV_IN_GLOB = /(^|[/*])\.env/i;

// AI가 수정하면 안 되는 보호 설정 (이 훅과 settings 자체)
const PROTECTED_CONFIG = /\.claude\/(settings(\.local)?\.json|hooks(\/|$))/;

// 디렉터리 전체를 훑어 gitignore된 .env 내용까지 읽게 되는 명령
const BULK_READ_COMMANDS = [
  /\b[ef]?grep\b[^|;&]*\s(-[a-zA-Z]*[rR][a-zA-Z]*|--recursive|--dereference-recursive)\b/, // grep -r / -R
  /\brg\b[^|;&]*\s(-[a-zA-Z]*u[a-zA-Z]*|--no-ignore\S*)/, // rg -u / --no-ignore (gitignore 무시)
  /(\bxargs|\s-exec)\b[^|;&]*\b(cat|grep|head|tail|less|more|strings|base64|xxd|od)\b/, // find ... | xargs cat
];

// 프로세스 환경 변수 전체를 출력하는 명령 (셸에 export된 API 키 노출)
const ENV_DUMP = [
  /(^|[;&|(]\s*)printenv\b/,
  /(^|[;&|(]\s*)(env|export\s+-p|declare\s+-x)\s*($|[;&|)>])/,
];

// 보호 설정을 바꿀 수 있는 셸 동작
const WRITE_OPS =
  /\b(rm|mv|cp|tee|chmod|chown|truncate|ln|dd|install|unlink)\b|\bsed\b[^|;&]*\s-i|\bperl\b[^|;&]*\s-[a-z]*i|\bgit\s+(checkout|restore|rm|mv|stash)\b/;
const REDIRECT_TO_PROTECTED =
  />{1,2}\s*["']?[^\s"'&|;]*\.claude\/(settings|hooks)/;

function isSensitivePath(value) {
  if (typeof value !== "string" || value.length === 0) return false;

  const candidates = [value];
  try {
    // 심볼릭 링크로 우회하는 경우까지 실제 경로로 확인한다.
    candidates.push(realpathSync(value));
  } catch {
    // 존재하지 않는 경로는 입력 문자열만 검사한다.
  }

  return candidates.some((candidate) => {
    const normalized = candidate.replaceAll("\\", "/");
    const base = path.posix.basename(normalized);
    return (
      SENSITIVE_NAMES.some((pattern) => pattern.test(base)) ||
      SENSITIVE_DIRS.test(normalized) ||
      ENV_IN_GLOB.test(normalized)
    );
  });
}

function isProtectedConfig(value) {
  return (
    typeof value === "string" &&
    PROTECTED_CONFIG.test(value.replaceAll("\\", "/"))
  );
}

// 셸 명령을 토큰으로 쪼개 각 토큰을 경로로 간주해 검사한다.
function mentionsSensitivePath(command) {
  return command
    .split(/[\s'"`;|&<>(){}[\]=:,$]+/)
    .filter(Boolean)
    .some(isSensitivePath);
}

function inspectCommand(command) {
  if (typeof command !== "string") return null;

  if (mentionsSensitivePath(command)) {
    return "민감 파일을 참조하는 명령 차단";
  }
  if (BULK_READ_COMMANDS.some((pattern) => pattern.test(command))) {
    return "gitignore를 무시하고 디렉터리 전체를 읽는 명령 차단 (Grep 도구 또는 옵션 없는 rg 사용)";
  }
  if (ENV_DUMP.some((pattern) => pattern.test(command))) {
    return "환경 변수 전체를 출력하는 명령 차단";
  }
  if (
    PROTECTED_CONFIG.test(command) &&
    (WRITE_OPS.test(command) || REDIRECT_TO_PROTECTED.test(command))
  ) {
    return "보호 설정(.claude/settings*.json, .claude/hooks) 변경 차단";
  }
  return null;
}

function targetsOf(toolName, input) {
  switch (toolName) {
    case "Read":
      return { paths: [input.file_path] };
    case "Edit":
    case "Write":
    case "MultiEdit":
      return { paths: [input.file_path], writes: [input.file_path] };
    case "NotebookEdit":
      return { paths: [input.notebook_path], writes: [input.notebook_path] };
    case "Glob":
      return { paths: [input.path, input.pattern] };
    case "Grep":
      return { paths: [input.path, input.glob] };
    case "Bash":
      return { command: input.command };
    default:
      return {};
  }
}

function block(reason) {
  process.stderr.write(
    `[보안] ${reason}\n` +
      "민감 파일(.env, 키, 인증 정보)과 보호 설정은 AI가 읽거나 수정할 수 없도록 프로젝트 설정으로 차단되어 있습니다. " +
      "값이 필요하면 사용자에게 변수 이름만 확인하고, 보호 설정 변경은 사용자가 직접 하도록 안내하세요.\n",
  );
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // 입력을 해석할 수 없으면 안전하게 차단한다 (fail-closed).
  block("훅 입력을 해석할 수 없어 도구 실행을 차단했습니다.");
}

const toolName = payload?.tool_name;
const {
  paths = [],
  writes = [],
  command,
} = targetsOf(toolName, payload?.tool_input ?? {});

const hitPath = paths.find(isSensitivePath);
if (hitPath) block(`${toolName}: 민감 파일 경로 접근 차단 (${hitPath})`);

const hitConfig = writes.find(isProtectedConfig);
if (hitConfig) block(`${toolName}: 보호 설정 변경 차단 (${hitConfig})`);

const commandIssue = inspectCommand(command);
if (commandIssue) block(`${toolName}: ${commandIssue}`);

process.exit(0);
