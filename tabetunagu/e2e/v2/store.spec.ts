import { expect, test, type Page } from "@playwright/test";
import { pickupTimesFromNow } from "../support/time";

/** 店舗ダッシュボード・出品・売上（オーナー / スタッフ）。デモの大通ベーカリーは STANDARD・売上受取設定は未完了 */
async function demoLogin(page: Page, account: "storeOwner" | "storeStaff" | "admin") {
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

test("オーナー（PC）: 今日の数字・出品 CTA・これから受取 → 店舗モニター・売上とプラン・導入準備・売上受取設定", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await demoLogin(page, "storeOwner");
  await page.goto("/store");
  await expect(page.getByRole("heading", { level: 1, name: "今日のTABETUNAGU" })).toBeVisible();
  await expect(page.getByTestId("store-brand-copy")).toHaveText("余ったら、出品するだけ。売れたら、渡すだけ。");
  await expect(page.getByTestId("store-cta-publish")).toBeVisible();
  for (const id of ["store-today-sales", "store-today-orders", "store-upcoming", "store-month-sales"]) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId("store-today-sales")).toContainText("円");
  await expect(page.getByTestId("store-plan-name")).toHaveText("STANDARD");
  await expect(page.getByTestId("store-plan")).toContainText("決済手数料込み");
  await expect(page.getByTestId("readiness-progress")).toHaveText(/^\d \/ 5 完了$/);
  // 売上受取設定（未完了 → 設定への導線。内部の値は出さない）
  await expect(page.getByTestId("store-alert-stripe")).toHaveText("売上受取設定を完了してください");
  await expect(page.getByTestId("store-alert-stripe")).toHaveAttribute("href", "/store/payouts");
  await expect(page.getByTestId("store-dashboard")).not.toContainText(/acct_|charges_enabled|payouts_enabled/);
  // 一画面で見渡せる（出品・受取・売上・導入準備が最初の画面に入る）
  for (const id of ["store-cta-publish", "store-upcoming", "store-month-sales"]) {
    expect((await page.getByTestId(id).boundingBox())!.y).toBeLessThan(900);
  }
  await page.getByTestId("store-upcoming").click();
  await page.waitForURL(/\/store\/monitor$/);
  await expect(page.getByTestId("store-monitor")).toBeVisible();
});

test("オーナー（375px）: 出品（お得率・受取時間のプレビュー・日付またぎ）→ 公開 → 商品一覧 → 複製（数量・受取時間は空）", async ({ page }) => {
  await demoLogin(page, "storeOwner");
  await page.goto("/store");
  await expectNoHorizontalScroll(page);
  const cta = page.getByTestId("store-cta-publish");
  expect((await cta.boundingBox())!.y).toBeLessThan(740);
  await cta.click();
  await page.waitForURL(/\/store\/products\/new$/);

  await page.getByLabel("商品名").fill("E2E店舗ダッシュボードBOX");
  await page.getByLabel("食べつなぎ価格").fill("750");
  await page.getByLabel("通常価格（相当）").fill("1500");
  await expect(page.getByTestId("discount-preview")).toHaveText("50%OFF（750円おトク）");
  await page.getByLabel("通常価格（相当）").fill("700"); // 販売価格より安い参考価格（異常値）では表示しない
  await expect(page.getByTestId("discount-preview")).toHaveText("");
  await page.getByLabel("通常価格（相当）").fill("1500");
  await page.getByLabel("数量").fill("3");
  // 日付またぎ（終了が開始より小さい）は翌日として表示する
  await page.getByLabel("受取開始").fill("23:30");
  await page.getByLabel("受取終了").fill("01:30");
  await expect(page.getByTestId("pickup-preview")).toContainText(/\d+\/\d+ 23:30〜\d+\/\d+ 01:30/);
  await expect(page.getByTestId("pickup-preview")).toContainText("（終了は翌日）");
  // 公開前のプレビュー
  await expect(page.getByTestId("product-preview")).toContainText("E2E店舗ダッシュボードBOX");
  await expect(page.getByTestId("product-preview")).toContainText("1,500円相当");
  await expect(page.getByTestId("product-preview")).toContainText("50%OFF");
  // 実際の公開は「いま」からの受取時間で
  const times = pickupTimesFromNow(120);
  await page.getByLabel("受取開始").fill(times.start);
  await page.getByLabel("受取終了").fill(times.end);
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "確認して公開する" }).click();
  await page.waitForURL(/\/store\?published=/);
  await expect(page.getByText("出品しました。")).toBeVisible();

  await page.goto("/store/products");
  const row = page.locator("tr").filter({ hasText: "E2E店舗ダッシュボードBOX" });
  await expect(row.getByTestId("product-state")).toHaveText("公開中");
  await expect(row).toContainText("1,500円相当");
  await row.getByTestId("product-duplicate").click();
  await page.waitForURL(/\/store\/products\/new\?from=/);
  await expect(page.getByLabel("商品名")).toHaveValue("E2E店舗ダッシュボードBOX");
  await expect(page.getByLabel("食べつなぎ価格")).toHaveValue("750");
  await expect(page.getByLabel("数量")).toHaveValue("");
  await expect(page.getByLabel("受取開始")).toHaveValue("");
  await expect(page.getByLabel("受取終了")).toHaveValue("");
});

test("売上: 今日・7日・今月の切り替え。店舗受取見込（目安）と売上の定義", async ({ page }) => {
  await demoLogin(page, "storeOwner");
  await page.goto("/store/sales");
  const tabs = page.getByTestId("sales-period");
  await expect(tabs.getByRole("link", { name: "今月" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("v2-sales")).toContainText("返金済み・お支払い待ちは含みません");
  for (const name of ["今日", "7日", "今月"]) {
    await tabs.getByRole("link", { name }).click();
    await expect(tabs.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("sales-net").or(page.getByTestId("sales-empty"))).toBeVisible();
  }
  await expectNoHorizontalScroll(page);
});

test("FREE プラン: 手数料20%を表示し、STANDARD は「申込準備中」（この画面でプランは変わらない）", async ({ browser, page }) => {
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminCtx.newPage();
  await demoLogin(admin, "admin");
  await admin.goto("/admin/stores");
  await admin.getByRole("link", { name: "大通ベーカリー" }).first().click();
  const setPlan = async (plan: "free" | "standard") => {
    await admin.locator("#plan").selectOption(plan);
    await admin.getByRole("button", { name: "更新する" }).click();
    await admin.waitForLoadState("networkidle");
  };
  try {
    await setPlan("free");
    await demoLogin(page, "storeOwner");
    await page.goto("/store");
    await expect(page.getByTestId("store-plan-name")).toHaveText("FREE");
    await expect(page.getByTestId("store-plan")).toContainText("成約手数料 20%");
    await page.goto("/store/settings");
    await expect(page.getByTestId("standard-preparing")).toContainText("STANDARD 申込準備中");
    await expect(page.getByRole("button", { name: /STANDARD に変更する/ })).toHaveCount(0);
    await expect(page.locator("#plan")).toContainText("まずは FREE で始められます。");
  } finally {
    await setPlan("standard");
    await adminCtx.close();
  }
});

test("スタッフ: 売上・プラン・売上受取設定を出さない。注文・モニター・出品は使える", async ({ page }) => {
  await demoLogin(page, "storeStaff");
  await page.goto("/store");
  await expect(page.getByTestId("store-dashboard")).toHaveAttribute("data-role", "staff");
  await expect(page.getByTestId("store-today-orders")).toBeVisible();
  await expect(page.getByTestId("store-upcoming")).toBeVisible();
  await expect(page.getByTestId("store-cta-publish")).toBeVisible();
  await expect(page.getByTestId("store-today-sales")).toHaveCount(0);
  await expect(page.getByTestId("store-month-sales")).toHaveCount(0);
  await expect(page.getByTestId("store-plan")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "売上・手数料", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "売上受取設定", exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="/store/payouts"]')).toHaveCount(0);
  await page.goto("/store/sales");
  await expect(page.getByText("売上・手数料は店舗オーナーが確認できます。")).toBeVisible();
  await expect(page.getByTestId("v2-sales")).toHaveCount(0);
});
