import { expect, test, type Page } from "@playwright/test";

/** 旧フローの店舗ダッシュボードにも「かんたん出品」「昨日と同じ / もう一度出品」を出す（「出品する」は残す） */
async function demoLogin(page: Page, account: "storeOwner" | "user") {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

test("店舗ダッシュボード: かんたん出品・もう一度出品・出品する（詳細）", async ({ page }) => {
  await demoLogin(page, "storeOwner");
  await page.goto("/store");
  await expect(page.getByTestId("store-cta-quick")).toBeVisible();
  await expect(page.getByTestId("store-cta-publish")).toBeVisible();
  await page.getByTestId("store-cta-relist").click();
  await page.waitForURL(/\/store\/products\/quick\?from=/);
  await expect(page.getByTestId("quick-relist-form")).toBeVisible();
  await expect(page.getByTestId("quick-relist-quantity")).toHaveValue("");
});

test("一般ユーザーはかんたん出品を開けない", async ({ page }) => {
  await demoLogin(page, "user");
  const res = await page.goto("/store/products/quick");
  expect(res?.status()).toBe(404);
});
