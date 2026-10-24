import { expect, test, type Page } from "@playwright/test";

async function demoLogin(page: Page, account: "user") {
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

test("マイページ（v2・375px）: LINE通知「今日の注目商品」は既定で OFF", async ({ page }) => {
  await demoLogin(page, "user");
  await page.goto("/me");
  await page.locator("summary", { hasText: "LINE通知" }).click();
  const form = page.getByTestId("line-featured-optin");
  await expect(form).toBeVisible();
  await expect(form).toHaveAttribute("data-on", "off");
  await expect(form).toContainText("今日の注目商品");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
