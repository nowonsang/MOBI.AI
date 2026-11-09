import { defineConfig, globalIgnores } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";
import pluginQuery from "@tanstack/eslint-plugin-query";
import boundaries from "eslint-plugin-boundaries";
import globals from "globals";

// 아키텍처 계층 강제. 의존 방향: app → core → features → shared → (native 모듈)
// - 같은 서비스(features/<서비스>) 내부 import는 허용, 다른 서비스 import는 금지
// - features는 core 중 store/hooks.ts(타입 지정 훅)만 사용 가능
// - 네이티브 모듈(modules/*)은 shared 만 import 한다 (차량 SDK 접근 창구를 shared/pleos 하나로 모은다)
// - src 아래에서 계층에 속하지 않는 파일은 금지 (예: src/utils/*)
const architecture = {
  files: ["src/**/*.{ts,tsx}"],
  plugins: { boundaries },
  settings: {
    "import/resolver": {
      typescript: { project: "./tsconfig.json" },
      node: true,
    },
    "boundaries/elements": [
      { type: "app", pattern: "src/app" },
      { type: "core", pattern: "src/core" },
      { type: "feature", pattern: "src/features/*", capture: ["service"] },
      { type: "shared", pattern: "src/shared" },
      { type: "native", pattern: "modules/*", capture: ["module"] },
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
          "아키텍처 위반: {{ from.element.type }} 계층은 {{ to.element.type }} 계층을 import 할 수 없습니다. (app → core → features → shared → native, 서비스 간 import 금지)",
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
          {
            from: { element: { type: "shared" } },
            allow: { to: { element: { type: "native" } } },
          },
        ],
      },
    ],
    "boundaries/no-unknown-files": "error",
  },
};

// 디자인 토큰 강제: 색상은 src/shared/ui/theme.ts 의 토큰(colors.primary 등)만 쓴다 (ui-design 스킬).
const HARD_CODED_COLOR = "/^(#[0-9a-fA-F]{3,8}|(rgb|hsl)a?\\()/";
const designTokenRules = [
  {
    selector: `Literal[value=${HARD_CODED_COLOR}]`,
    message:
      "임의 색상 금지: src/shared/ui/theme.ts 의 디자인 토큰(colors.primary, colors.inkSecondary 등)을 사용하세요.",
  },
  {
    selector: `TemplateElement[value.raw=${HARD_CODED_COLOR}]`,
    message:
      "임의 색상 금지: src/shared/ui/theme.ts 의 디자인 토큰(colors.primary, colors.inkSecondary 등)을 사용하세요.",
  },
];

const restrictedImports = [
  {
    // 앱 번들에 들어간 키는 누구나 꺼낼 수 있다. 공유 Supabase 의 키를 앱에 넣지 않는다 (supabase-schema 스킬).
    group: ["@supabase/*"],
    message:
      "앱에서 Supabase 에 직접 접속하지 않습니다 (키가 APK 에 노출됨). DB 가 필요하면 백엔드 구조를 먼저 사용자와 정하세요.",
  },
];

const codeRules = [
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/shared/pleos/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...restrictedImports,
            {
              group: ["@modules/*", "**/modules/*"],
              message:
                "차량 SDK(Pleos) 네이티브 모듈은 @/shared/pleos/* 를 통해서만 사용합니다.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/shared/pleos/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: restrictedImports }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/shared/ui/theme.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...designTokenRules],
    },
  },
  {
    // Node 에서 실행되는 개발 도구·설정 파일
    files: ["scripts/**/*.mjs", "**/app.plugin.js", "*.config.{js,mjs,ts}"],
    languageOptions: { globals: globals.node },
  },
];

export default defineConfig([
  ...expoConfig,
  ...pluginQuery.configs["flat/recommended"],
  architecture,
  ...codeRules,
  globalIgnores([
    "android/**",
    "ios/**",
    ".expo/**",
    "dist/**",
    "coverage/**",
    "expo-env.d.ts",
  ]),
]);
