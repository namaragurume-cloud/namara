import { expect, test, type Page } from "@playwright/test";

/** LINE 日次注目商品通知（オプトイン）。開発環境は送信フラグなし = dry run（LINE へは送らない） */
async function demoLogin(page: Page, account: "user" | "admin") {
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

test("マイページ: LINE通知「今日の注目商品」は既定で OFF。LINE 未連携なら ON にできない", async ({ page }) => {
  await demoLogin(page, "user");
  await page.goto("/me");
  const form = page.getByTestId("line-featured-optin");
  await expect(form).toBeVisible();
  await expect(form).toContainText("今日の注目商品");
  await expect(form).toHaveAttribute("data-on", "off");
  await expect(form).toContainText("LINEでログインすると、通知を受け取れます。");
  await expect(form.getByRole("button", { name: "ONにする" })).toHaveCount(0);
});

test("管理者: LINE日次通知（集計・今日の商品・dry run）。Broadcast のボタンはない", async ({ page }) => {
  await demoLogin(page, "admin");
  await page.goto("/admin/line-digest");
  const root = page.getByTestId("line-digest");
  await expect(root).toBeVisible();
  await expect(page.getByTestId("line-digest-flags")).toContainText("dry run");
  await expect(page.getByTestId("digest-opt-in")).toBeVisible();
  await expect(page.getByTestId("digest-sent")).toBeVisible();
  await expect(page.getByTestId("digest-failed")).toBeVisible();
  await expect(page.getByTestId("digest-products").or(page.getByTestId("digest-no-products"))).toBeVisible();
  await expect(root.getByRole("button", { name: /Broadcast|一斉|全員/ })).toHaveCount(0);
  await root.getByRole("button", { name: "dry run を実行する" }).click();
  await expect(root.getByText(/dry run: 対象|今日の注目商品がないため/)).toBeVisible();
});

test("一般ユーザーは LINE日次通知の管理画面を開けない", async ({ page }) => {
  await demoLogin(page, "user");
  const res = await page.goto("/admin/line-digest");
  expect(res?.status()).toBe(404);
});
