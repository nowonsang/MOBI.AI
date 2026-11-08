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

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...pluginQuery.configs["flat/recommended"],
  architecture,
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
