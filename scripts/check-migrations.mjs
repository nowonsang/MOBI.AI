#!/usr/bin/env node
// supabase/migrations/*.sql 이 mobi_ai 스키마 격리 규칙을 지키는지 검사한다: `npm run check:migrations`
// 다른 서비스와 같은 Supabase 프로젝트를 공유하므로, 스키마를 명시하지 않은 객체는 공유 서비스의 public 스키마에 생긴다.
// 인자로 파일 경로를 주면 그 파일만 검사한다.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SCHEMA = "mobi_ai";
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const FILE_NAME = /^\d{14}_[a-z0-9_]+\.sql$/;

// 공유 서비스 또는 Supabase가 소유한 공유 스키마
const SHARED_SCHEMA_REF =
  /\b(public|auth|storage|realtime|graphql|graphql_public|vault|net|cron|supabase_functions|supabase_migrations|pgsodium|pgbouncer)\s*\.\s*"?([a-z_][a-z0-9_$]*)"?/g;

// 대상 객체가 반드시 mobi_ai 이어야 하는 구문. schemaLevel: 스키마 이름 자체가 대상인 구문
const TARGET_RULES = [
  {
    pattern:
      /\bcreate\s+(?:or\s+replace\s+)?(?:unlogged\s+)?(?:table|view|materialized\s+view|function|procedure|type|sequence|domain)\s+(?:if\s+not\s+exists\s+)?([^\s(;]+)/g,
  },
  {
    pattern:
      /\balter\s+(?:table|view|materialized\s+view|function|procedure|type|sequence|domain)\s+(?:if\s+exists\s+)?(?:only\s+)?([^\s(;]+)/g,
  },
  {
    pattern:
      /\bdrop\s+(?:table|view|materialized\s+view|function|procedure|type|sequence|domain)\s+(?:if\s+exists\s+)?([^\s(;,]+)/g,
  },
  {
    pattern:
      /\bcreate\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?\S+\s+on\s+(?:only\s+)?([^\s(;]+)/g,
  },
  {
    pattern:
      /\bcreate\s+(?:or\s+replace\s+)?(?:constraint\s+)?trigger\s+\S+\s+(?:before|after|instead\s+of)\s+.+?\s+on\s+([^\s(;]+)/g,
  },
  { pattern: /\bcreate\s+policy\s+(?:"[^"]*"|\S+)\s+on\s+([^\s(;]+)/g },
  {
    pattern:
      /\bdrop\s+(?:trigger|policy)\s+(?:if\s+exists\s+)?(?:"[^"]*"|\S+)\s+on\s+([^\s(;]+)/g,
  },
  { pattern: /\binsert\s+into\s+([^\s(;]+)/g },
  {
    pattern:
      /(?<!\b(?:before|after|or|of|for|on|instead)\s+)\bupdate\s+(?!on\b|of\b|set\b)(?:only\s+)?([^\s(;,]+)/g,
  },
  { pattern: /\bdelete\s+from\s+(?:only\s+)?([^\s(;]+)/g },
  { pattern: /\btruncate\s+(?:table\s+)?(?:only\s+)?([^\s(;,]+)/g },
  {
    pattern:
      /\bcomment\s+on\s+(?:table|column|function|view|type)\s+([^\s(;]+)/g,
  },
  {
    pattern:
      /\b(?:grant|revoke)\b.*?\bon\s+(?:table\s+|function\s+|procedure\s+|routine\s+|sequence\s+)?(?!schema\b|all\b)([^\s(;,]+)/g,
  },
  {
    pattern:
      /\b(?:grant|revoke)\b.*?\bon\s+(?:schema|all\s+(?:tables|functions|sequences|routines|procedures)\s+in\s+schema)\s+([^\s;,]+)/g,
    schemaLevel: true,
  },
  {
    pattern: /\bcreate\s+schema\s+(?:if\s+not\s+exists\s+)?([^\s;]+)/g,
    schemaLevel: true,
  },
];

// 주석과 문자열을 지우고 문장 단위로 나눈다. $$ 함수 본문 안의 ; 로는 나누지 않는다.
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let dollarTag = null;
  let i = 0;
  while (i < sql.length) {
    const rest = sql.slice(i);
    if (dollarTag && rest.startsWith(dollarTag)) {
      current += dollarTag;
      i += dollarTag.length;
      dollarTag = null;
      continue;
    }
    if (rest.startsWith("--")) {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      continue;
    }
    if (rest.startsWith("/*")) {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j += 1;
      }
      current += "''";
      i = j + 1;
      continue;
    }
    if (!dollarTag) {
      const tag = rest.match(/^\$[a-zA-Z_]*\$/);
      if (tag) {
        dollarTag = tag[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
      if (sql[i] === ";") {
        statements.push(current);
        current = "";
        i += 1;
        continue;
      }
    }
    current += sql[i];
    i += 1;
  }
  statements.push(current);
  return statements
    .map((statement) => statement.toLowerCase().replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const unquote = (name) => name.replaceAll('"', "");
const preview = (statement) =>
  statement.length > 90 ? `${statement.slice(0, 90)}…` : statement;

function checkFile(filePath) {
  const errors = [];
  const warnings = [];
  const fileName = path.basename(filePath);

  if (!FILE_NAME.test(fileName)) {
    errors.push(
      `파일 이름은 <YYYYMMDDHHMMSS>_<snake_case 설명>.sql 형식이어야 합니다`,
    );
  }

  const statements = splitStatements(readFileSync(filePath, "utf8"));
  const createdTables = new Set();
  const rlsTables = new Set();

  for (const statement of statements) {
    const where = `"${preview(statement)}"`;

    if (/\bdrop\s+schema\b/.test(statement)) {
      errors.push(
        `${where}: 스키마 삭제는 마이그레이션에 넣지 않습니다 (해커톤 종료 정리는 사람이 직접)`,
      );
    }
    if (/\bcreate\s+extension\b/.test(statement)) {
      errors.push(
        `${where}: 확장(extension)은 공유 서비스와 함께 쓰므로 사용자와 상의 후 직접 설치합니다`,
      );
    }
    if (/\bsecurity\s+definer\b/.test(statement)) {
      errors.push(
        `${where}: security definer 함수는 사용자와 상의가 필요합니다 (security invoker 사용)`,
      );
    }
    if (
      /^create (or replace )?function\b/.test(statement) &&
      !/\bset\s+search_path\s*(=|to)\s*''/.test(statement)
    ) {
      errors.push(`${where}: 함수에 set search_path = '' 가 필요합니다`);
    }

    if (/^alter default privileges\b/.test(statement)) {
      // 스키마를 지정하지 않으면 프로젝트 전체(공유 서비스 포함)의 기본 권한이 바뀐다.
      if (!new RegExp(`\\bin schema ${SCHEMA}\\b`).test(statement)) {
        errors.push(
          `${where}: alter default privileges 에는 in schema ${SCHEMA} 가 필요합니다`,
        );
      }
      continue;
    }

    for (const match of statement.matchAll(SHARED_SCHEMA_REF)) {
      const [, schema, name] = match;
      const before = statement.slice(0, match.index);
      const after = statement.slice(match.index + match[0].length);
      const allowed =
        // RLS 정책에서 현재 로그인 사용자를 확인하는 함수 호출
        (schema === "auth" &&
          ["uid", "jwt", "role", "email"].includes(name) &&
          /^\s*\(/.test(after)) ||
        // 공유 로그인 사용자를 가리키는 외래 키
        (schema === "auth" &&
          name === "users" &&
          /\breferences\s*$/.test(before));
      if (!allowed) {
        errors.push(
          `${where}: 공유 서비스·Supabase 소유 스키마(${schema}.${name})는 건드리지 않습니다`,
        );
      }
    }

    for (const { pattern, schemaLevel } of TARGET_RULES) {
      for (const match of statement.matchAll(pattern)) {
        const target = unquote(match[1]);
        // 공유 스키마 대상은 위에서 이미 보고했다.
        if (new RegExp(SHARED_SCHEMA_REF.source).test(target)) continue;
        if (schemaLevel && target !== SCHEMA) {
          errors.push(
            `${where}: ${SCHEMA} 이외의 스키마("${target}")는 만들거나 권한을 바꾸지 않습니다`,
          );
        } else if (!schemaLevel && !target.startsWith(`${SCHEMA}.`)) {
          errors.push(
            `${where}: 대상 "${target}" 에 ${SCHEMA}. 스키마를 명시해야 합니다 (생략하면 공유 서비스의 public 에 생성됨)`,
          );
        }
      }
    }

    const created = statement.match(
      /^create (?:unlogged )?table (?:if not exists )?([^\s(]+)/,
    );
    if (created) createdTables.add(unquote(created[1]));
    const rls = statement.match(
      /^alter table (?:if exists )?(?:only )?([^\s]+) enable row level security/,
    );
    if (rls) rlsTables.add(unquote(rls[1]));

    if (
      /^grant\b/.test(statement) &&
      /\bto\b.*\b(anon|authenticated|public)\b/.test(statement)
    ) {
      warnings.push(
        `${where}: anon/authenticated 는 공유 서비스 공개 키·로그인 사용자와 공유됩니다. 사용자 확인을 받았는지 확인하세요`,
      );
    }
  }

  for (const table of createdTables) {
    if (!rlsTables.has(table)) {
      errors.push(
        `테이블 ${table}: 같은 파일에 "alter table ${table} enable row level security" 가 필요합니다`,
      );
    }
  }

  return { errors, warnings };
}

const files =
  process.argv.length > 2
    ? process.argv.slice(2)
    : existsSync(MIGRATIONS_DIR)
      ? readdirSync(MIGRATIONS_DIR)
          .filter((name) => name.endsWith(".sql"))
          .sort()
          .map((name) => path.join(MIGRATIONS_DIR, name))
      : [];

let errorCount = 0;
for (const file of files) {
  const { errors, warnings } = checkFile(file);
  const label = path.relative(process.cwd(), file);
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`PASS ${label}`);
    continue;
  }
  console.log(`${errors.length > 0 ? "FAIL" : "WARN"} ${label}`);
  for (const error of errors) console.log(`  - [오류] ${error}`);
  for (const warning of warnings) console.log(`  - [주의] ${warning}`);
  errorCount += errors.length;
}

if (files.length === 0) console.log("검사할 마이그레이션이 없습니다");
process.exit(errorCount === 0 ? 0 : 1);
