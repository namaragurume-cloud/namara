import { expect, test } from "@playwright/test";

/** 機能フラグ OFF（既定）では旧導線のまま（予約 → 店頭 QR）。v2 のナビ・説明は出さない */
test("フラグ OFF: ナビは「予約」「QR」、商品詳細の「食べつなぐ」は予約確認へ", async ({ page }) => {
  await page.goto("/login");
  await page.locator('form:has(input[value="user"]) button').click();
  await page.waitForLoadState("networkidle");
  const nav = page.getByRole("navigation", { name: "メインメニュー" });
  await expect(nav.getByRole("link", { name: "予約" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "QR" })).toBeAttached();
  await expect(nav.getByRole("link", { name: "注文" })).toHaveCount(0);

  await page.goto("/stores/sapporo-sweets-lab");
  await page.getByRole("link", { name: /ケーキの食べつなぎBOX/ }).first().click();
  await expect(page.getByTestId("charge-note")).toHaveCount(0);
  await expect(page.getByText("店頭のQRを読み取ってから、お会計です。")).toBeVisible();
  await page.getByRole("link", { name: "食べつなぐ" }).click();
  await page.waitForURL(/\/reserve$/);
  await expect(page.getByRole("button", { name: "予約を確定する" })).toBeVisible();
});
