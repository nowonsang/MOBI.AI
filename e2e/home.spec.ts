import { expect, test } from "@playwright/test";

// 화면 폭별 좌우 여백 (ui-design 스킬 1장: 20 → 24 → 30px)
function expectedSidePadding(width: number) {
  if (width >= 1024) return "30px";
  if (width >= 768) return "24px";
  return "20px";
}

test.describe("시작 화면", () => {
  test("제목과 안내 문구가 보인다", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "MOBI.AI" }),
    ).toBeVisible();
    await expect(page.getByText("서비스를 준비하고 있어요.")).toBeVisible();
  });

  test("가로 스크롤이 생기지 않는다", async ({ page }) => {
    await page.goto("/");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("화면 폭에 맞는 좌우 여백을 쓴다", async ({ page }) => {
    await page.goto("/");

    const width = page.viewportSize()?.width ?? 0;
    await expect(page.getByRole("main")).toHaveCSS(
      "padding-left",
      expectedSidePadding(width),
    );
  });

  test("콘솔 에러가 없다 (CSP 위반 포함)", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(errors).toEqual([]);
  });
});
