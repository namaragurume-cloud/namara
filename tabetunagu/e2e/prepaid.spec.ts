import { expect, test, type Page } from "@playwright/test";
import { pickupTimesFromNow } from "./support/time";

async function demoLogin(page: Page, account: "user" | "storeOwner") {
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

/** v2 事前決済の画面（Stripe 未設定の環境。Stripe には通信しない） */
test("売上受取設定が未完了の店舗の商品は、購入確認画面で購入できないと表示する", async ({ browser, page }) => {
  // 受付中の商品を出品する（他のテストで売り切れになった商品に依存しない）
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const owner = await ownerCtx.newPage();
  await demoLogin(owner, "storeOwner");
  await owner.goto("/store/products/new");
  await owner.getByLabel("商品名").fill("E2E事前決済BOX");
  await owner.getByLabel("通常価格（相当）").fill("1500");
  await owner.getByLabel("食べつなぎ価格").fill("800");
  await owner.getByLabel("数量").fill("5");
  const times = pickupTimesFromNow(120);
  await owner.getByLabel("受取開始").fill(times.start);
  await owner.getByLabel("受取終了").fill(times.end);
  await owner.getByRole("button", { name: "確認して公開する" }).click();
  await owner.waitForURL(/\/store\?published=/);
  await ownerCtx.close();

  await page.goto("/stores/odori-bakery");
  const href = await page.getByRole("link", { name: /E2E事前決済BOX/ }).first().getAttribute("href");
  expect(href).toBeTruthy();
  await demoLogin(page, "user");
  await page.goto(`${href}/buy`);
  await expect(page.getByRole("heading", { name: "注文内容の確認" })).toBeVisible();
  await expect(page.getByTestId("buy-summary")).toContainText("つなぐチャージ30円");
  await expect(page.getByText("現在この店舗の商品は購入準備中です。")).toBeVisible();
  await expect(page.getByTestId("buy-disabled")).toHaveText("購入準備中");
  await expect(page.getByTestId("buy-disabled")).toBeDisabled();
  await expect(page.getByRole("button", { name: /円で食べつなぐ/ })).toHaveCount(0);
});

test("店舗オーナーは売上受取設定の状態を確認できる", async ({ page }) => {
  await demoLogin(page, "storeOwner");
  await page.goto("/store/payouts");
  await expect(page.getByRole("heading", { name: "売上受取設定" })).toBeVisible();
  await expect(page.getByTestId("connect-status")).toContainText("決済の受付");
  await expect(page.getByText("オンライン決済は現在準備中です。")).toBeVisible();
});
