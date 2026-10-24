import { expect, test, type Page } from "@playwright/test";
import { pickupTimesFromNow } from "../support/time";

/** かんたん出品（過去の商品をもう一度出品）。375px のスマホ表示 */
async function demoLogin(page: Page, account: "storeOwner" | "storeStaff") {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

async function expectNoHorizontalScroll(page: Page) {
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("オーナー（375px）: ＋かんたん出品 → 過去の商品 → 数量・受取時間だけ入力 → 確認 → 出品しました！ → ダッシュボードに公開中・残り", async ({ page }) => {
  await demoLogin(page, "storeOwner");
  await page.goto("/store");
  await expectNoHorizontalScroll(page);
  // 「出品する」（詳細）は残す。かんたん出品が最初の画面に入る
  await expect(page.getByTestId("store-cta-publish")).toBeVisible();
  const quick = page.getByTestId("store-cta-quick");
  expect((await quick.boundingBox())!.y).toBeLessThan(740);
  await expect(page.getByTestId("store-cta-relist")).toContainText(/昨日と同じ商品を出品|もう一度出品/);
  await quick.click();
  await page.waitForURL(/\/store\/products\/quick$/);
  await expectNoHorizontalScroll(page);
  const first = page.getByTestId("quick-relist-recent").getByTestId("quick-relist-source").first();
  const name = (await first.locator("span.font-bold").first().textContent())!.trim();
  await first.click();
  await page.waitForURL(/\/store\/products\/quick\?from=/);
  await expectNoHorizontalScroll(page);

  // 引き継ぐ: 商品名・価格。数量・受取時間は空（過去の値を入れない）
  await expect(page.getByTestId("quick-relist-name")).toHaveText(name);
  await expect(page.getByTestId("quick-relist-price")).toHaveText(/円$/);
  await expect(page.getByTestId("quick-relist-quantity")).toHaveValue("");
  await expect(page.getByTestId("quick-relist-start")).toHaveValue("");
  await expect(page.getByTestId("quick-relist-end")).toHaveValue("");
  await expect(page.getByTestId("quick-relist-submit")).toBeDisabled();

  // 日付またぎの表示（23:00〜01:00 → 翌1:00）
  await page.getByTestId("quick-relist-start").fill("23:00");
  await page.getByTestId("quick-relist-end").fill("01:00");
  await expect(page.getByTestId("quick-relist-confirm-pickup")).toHaveText("今日 23:00〜翌1:00");

  // 今回の数量・受取時間
  const t = pickupTimesFromNow(120);
  await page.getByTestId("quick-relist-quantity").fill("5");
  await page.getByTestId("quick-relist-start").fill(t.start);
  await page.getByTestId("quick-relist-end").fill(t.end);
  const confirm = page.getByTestId("quick-relist-confirm");
  await expect(confirm).toContainText(name);
  await expect(confirm).toContainText(/5(BOX|個)/);
  await expect(confirm).toContainText(t.start);
  const submit = page.getByTestId("quick-relist-submit");
  await expect(submit).toBeEnabled();
  expect((await submit.boundingBox())!.width).toBeGreaterThan(300);
  await submit.click();

  const done = page.getByTestId("quick-relist-done");
  await expect(done).toContainText("出品しました！");
  await expect(page.getByTestId("quick-relist-done-summary")).toContainText(/公開中・残り5(BOX|個)/);
  await expect(page.getByTestId("quick-relist-view")).toBeVisible();
  await expect(page.getByTestId("quick-relist-again")).toHaveAttribute("href", "/store/products/quick");

  await page.goto("/store");
  await expect(page.getByText(new RegExp(`${t.start}〜${t.end}・.*残り 5/5`)).first()).toBeVisible();
});

test("スタッフ（375px）もかんたん出品を使える", async ({ page }) => {
  await demoLogin(page, "storeStaff");
  await page.goto("/store/products/quick");
  await expect(page.getByTestId("quick-relist-list")).toBeVisible();
  await expectNoHorizontalScroll(page);
});
