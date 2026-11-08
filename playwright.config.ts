import { defineConfig, devices } from "@playwright/test";

// E2E 테스트 (작성 규칙: e2e-testing 스킬)
// - npm run test:e2e     : Next.js 프로덕션 빌드(next start)에 대해 실행
// - npm run test:e2e:cf  : Cloudflare Workers 런타임(로컬 preview)에 대해 실행 — 실제 배포 환경과 같은 런타임
// 반응형 규칙(ui-design 스킬)에 맞춰 모든 테스트를 360 · 768 · 1440px 에서 실행한다.
const target = process.env.E2E_TARGET === "cloudflare" ? "cloudflare" : "node";
const PORT = target === "cloudflare" ? 8787 : 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    locale: "ko-KR",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-360",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 780 } },
    },
    {
      name: "tablet-768",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "desktop-1440",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command:
      target === "cloudflare"
        ? "npm run cf:preview"
        : `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
