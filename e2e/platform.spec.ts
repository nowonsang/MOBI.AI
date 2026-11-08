import { expect, test } from "@playwright/test";

// 배포 환경에서 깨지기 쉬운 공통 동작 (보안 헤더, 문서 설정, 404)
test.describe("플랫폼 공통", () => {
  test("보안 헤더가 붙는다", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(response.status()).toBe(200);
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("한국어 문서이고 확대를 막지 않는다", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "ko");
    const viewport = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");
    expect(viewport).toContain("viewport-fit=cover");
    expect(viewport).not.toContain("user-scalable=no");
    expect(viewport).not.toContain("maximum-scale=1");
  });

  test("없는 주소는 404 를 돌려준다", async ({ request }) => {
    const response = await request.get("/this-page-does-not-exist");

    expect(response.status()).toBe(404);
  });
});
