import { expect, test } from "@playwright/test";

/** 機能フラグ OFF: 商品詳細は旧フロー（予約）のまま。v2 の支払い合計・受け取り方・合計入りボタンを混ぜない */
test("フラグ OFF: 商品詳細に v2 の支払い合計・受け取り方を出さず、「食べつなぐ」は予約確認へ", async ({ page }) => {
  await page.goto("/stores/sapporo-sweets-lab");
  await page.locator('main a[href^="/products/"]').filter({ hasText: /ケーキの食べつなぎBOX/ }).first().click();
  await page.waitForURL(/\/products\/[0-9a-f-]+$/);
  await expect(page.getByTestId("detail-price")).toContainText("1,200円");
  await expect(page.getByTestId("detail-remaining")).toHaveText("残り3BOX");
  await expect(page.getByTestId("price-breakdown")).toHaveCount(0);
  await expect(page.getByTestId("pickup-guide")).toHaveCount(0);
  await expect(page.getByText(/円で食べつなぐ/)).toHaveCount(0);
  await expect(page.getByText("店頭のQRを読み取ってから、お会計です。")).toBeVisible();
  await expect(page.getByRole("link", { name: "食べつなぐ" })).toHaveAttribute("href", /\/reserve$/);

  // 旧フローの予約確認に、つなぐチャージ・Stripe・事前決済を混ぜない
  await page.getByRole("link", { name: "食べつなぐ" }).click();
  await page.waitForURL(/\/login/);
  await page.locator('form:has(input[value="user"]) button').click();
  await page.waitForURL(/\/reserve$/);
  await expect(page.getByRole("button", { name: "予約を確定する" })).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/つなぐチャージ|Stripe|事前決済/);
  await expect(page.getByRole("navigation", { name: "メインメニュー" })).toBeVisible();
});
