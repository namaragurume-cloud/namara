import { expect, test } from "@playwright/test";

/** 機能フラグ OFF: マイページは旧導線（予約 → 店頭 QR）のまま。v2 のポイント履歴ページは出さない */
test("フラグ OFF: マイページは予約の導線のまま。v2 の受取・ポイント履歴は出さない", async ({ page }) => {
  await page.goto("/login");
  await page.locator('form:has(input[value="user"]) button').click();
  await page.waitForLoadState("networkidle");
  await page.goto("/me");
  await expect(page.getByRole("link", { name: "今後の予約" })).toBeVisible();
  await expect(page.getByRole("link", { name: "予約履歴（過去の食べつなぎ）" })).toBeVisible();
  await expect(page.getByTestId("my-points")).toBeVisible();
  await expect(page.getByTestId("my-next-pickup")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "予約" })).toBeVisible();
  const res = await page.goto("/me/points");
  expect(res?.status()).toBe(404);
});
