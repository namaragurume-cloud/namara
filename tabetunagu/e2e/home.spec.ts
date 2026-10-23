import { expect, test } from "@playwright/test";

/** 機能フラグ OFF でもホームは壊れない（見た目は共通。購入導線だけ旧フロー） */
test("フラグ OFF: ホームが表示でき、商品カードから商品詳細 →「食べつなぐ」は予約確認へ", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("近くのおいしいを、おトクに。");
  await expect(page.getByTestId("available-count")).toContainText(/いま\s*\d+\s*件、食べつなげます。/);
  await expect(page.getByTestId("area-picker")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByTestId("home-recommended").getByTestId("deal-card").first().click();
  await page.waitForURL(/\/products\/[0-9a-f-]+$/);
  await page.getByRole("link", { name: "食べつなぐ" }).click();
  await page.waitForURL(/\/login\?next=.*reserve|\/reserve$/);
});
