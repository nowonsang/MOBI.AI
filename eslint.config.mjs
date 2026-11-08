import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import pluginQuery from "@tanstack/eslint-plugin-query";
import boundaries from "eslint-plugin-boundaries";

// 아키텍처 계층 강제. 의존 방향: app → core → features → shared (README "의존 방향" 참고)
// - 같은 서비스(features/<서비스>) 내부 import는 허용, 다른 서비스 import는 금지
// - features는 core 중 store/hooks.ts(타입 지정 훅)만 사용 가능
// - src 아래에서 계층에 속하지 않는 파일은 금지 (예: src/utils/*)
const architecture = {
  files: ["src/**/*.{ts,tsx}"],
  plugins: { boundaries },
  settings: {
    "boundaries/elements": [
      { type: "app", pattern: "src/app" },
      { type: "core", pattern: "src/core" },
      { type: "feature", pattern: "src/features/*", capture: ["service"] },
      { type: "shared", pattern: "src/shared" },
    ],
    "boundaries/files": [
      { pattern: "src/core/store/hooks.ts", category: "store-hooks" },
    ],
  },
  rules: {
    "boundaries/dependencies": [
      "error",
      {
        default: "disallow",
        message:
          "아키텍처 위반: {{ from.element.type }} 계층은 {{ to.element.type }} 계층을 import 할 수 없습니다. (app → core → features → shared, 서비스 간 import 금지)",
        policies: [
          {
            from: { element: { type: "app" } },
            allow: {
              to: { element: { types: ["core", "feature", "shared"] } },
            },
          },
          {
            from: { element: { type: "core" } },
            allow: { to: { element: { types: ["feature", "shared"] } } },
          },
          {
            from: { element: { type: "feature" } },
            allow: { to: { element: { type: "shared" } } },
          },
          {
            from: { element: { type: "feature" } },
            allow: { to: { file: { categories: "store-hooks" } } },
          },
        ],
      },
    ],
    "boundaries/no-unknown-files": "error",
  },
};

// 디자인 토큰 강제: 색상은 globals.css 의 토큰(bg-primary, text-ink 등)만 쓴다 (ui-design 스킬).
const HARD_CODED_COLOR = "/(\\[#[0-9a-fA-F]{3,8}\\])|(\\[(rgb|hsl)a?\\()/";
const designTokenRules = [
  {
    selector: `Literal[value=${HARD_CODED_COLOR}]`,
    message:
      "임의 색상 금지: globals.css 디자인 토큰(bg-primary, text-ink-secondary 등)을 사용하세요.",
  },
  {
    selector: `TemplateElement[value.raw=${HARD_CODED_COLOR}]`,
    message:
      "임의 색상 금지: globals.css 디자인 토큰(bg-primary, text-ink-secondary 등)을 사용하세요.",
  },
  {
    selector:
      "Property[key.name=/^(color|background|backgroundColor|borderColor|fill|stroke)$/] > Literal[value=/^(#|rgb|hsl)/]",
    message:
      "인라인 색상 금지: globals.css 디자인 토큰(var(--color-...))을 사용하세요.",
  },
];

// Supabase는 다른 서비스와 공유한다. DB 접근은 mobi_ai 스키마로 고정된 @/shared/supabase/admin 만 쓴다.
const supabaseIsolation = [
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/shared/supabase/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*"],
              message:
                "Supabase 클라이언트는 @/shared/supabase/admin 의 getSupabaseAdminClient()만 사용합니다 (mobi_ai 스키마 고정).",
            },
          ],
        },
      ],
    },
  },
  {
    // no-restricted-syntax 는 설정 블록끼리 옵션이 합쳐지지 않으므로 금지 구문을 이 블록 하나에 모은다.
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='schema']",
          message:
            "Supabase 스키마 전환 금지: mobi_ai 외의 스키마(public 등)는 공유 서비스 소유입니다.",
        },
        ...designTokenRules,
      ],
    },
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...pluginQuery.configs["flat/recommended"],
  architecture,
  ...supabaseIsolation,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
