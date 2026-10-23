import { expect, test, type Page } from "@playwright/test";

/**
 * 店舗の「TABETUNAGU を始める準備」。進捗は店舗の実際の状態から計算する（途中で閉じても続きから）。
 * E2E では Stripe と通信しないため、売上受取設定の完了は「設定済み」のデモ店舗（札幌スイーツラボ）で確認する。
 */
const OWNER_ID = "00000000-0000-4000-8000-000000000002";

async function demoLogin(page: Page, account: "storeOwner" | "storeStaff" | "admin") {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

async function progressDone(page: Page) {
  return Number(await page.getByTestId("store-onboarding").getAttribute("data-done"));
}

async function fillStoreInfo(page: Page, storeName?: string) {
  await page.goto("/store/settings#store-info");
  if (storeName) {
    // 店舗の切り替え直後は前の店舗の画面が残ることがあるため、対象の店舗が表示されるまで読み直す
    await expect(async () => {
      await page.reload();
      await expect(page.getByLabel("店舗名")).toHaveValue(storeName, { timeout: 2000 });
    }).toPass({ timeout: 20_000 });
  }
  await page.getByLabel("電話番号").fill("011-000-0000");
  await page.getByLabel("営業時間").fill("10:00〜21:00");
  await page.getByLabel("受け取り時のご案内").fill("入口すぐのカウンターでお渡しします。");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByText("店舗情報を保存しました。")).toBeVisible();
}

test("オーナー（375px）: ダッシュボード → 始める準備 → 店舗情報 → 売上受取設定の導線 → 公開準備の理由 → モニター。中断しても続きから", async ({ page }) => {
  await demoLogin(page, "storeOwner");
  await page.goto("/store");
  const banner = page.getByTestId("store-readiness");
  await expect(banner).toHaveAttribute("data-complete", "no");
  await banner.getByRole("link", { name: "続きから準備する" }).click();
  await page.waitForURL(/\/store\/start$/);
  await expect(page.getByRole("heading", { level: 1, name: "TABETUNAGU を始める準備" })).toBeVisible();
  await expect(page.getByTestId("onboarding-progress-label")).toHaveText(/^\d \/ 5 完了$/);
  await expect(page.getByTestId("onboarding-next")).toContainText("次にやること");
  for (const t of ["導入費ゼロ", "オンライン事前決済", "受取時の店舗操作は原則ありません"]) await expect(page.getByText(t, { exact: false }).first()).toBeVisible();
  // スマホでも進捗と次にやることが最初の画面に入る
  expect((await page.getByTestId("onboarding-next").boundingBox())!.y).toBeLessThan(740);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const before = await progressDone(page);

  // 1. 店舗情報（未入力の項目だけ促す）→ 入力すると完了
  const info = page.getByTestId("onboarding-step-info");
  if ((await info.getAttribute("data-done")) === "no") {
    await expect(info.getByTestId("onboarding-step-status")).toContainText("入力してください");
    await info.getByTestId("onboarding-step-cta").click();
    await page.waitForURL(/\/store\/settings/);
    await fillStoreInfo(page);
    await page.goto("/store/start");
    await expect(page.getByTestId("onboarding-step-info")).toHaveAttribute("data-done", "yes");
    expect(await progressDone(page)).toBe(before + 1);
  }

  // 2. 売上受取設定（技術用語は出さない）
  const payout = page.getByTestId("onboarding-step-payout");
  await expect(payout).toHaveAttribute("data-done", "no");
  await expect(payout.getByTestId("onboarding-step-status")).toHaveText("売上を受け取るための設定です。");
  await expect(page.getByTestId("store-onboarding")).not.toContainText(/Stripe Connect|Express|charges_enabled|payouts_enabled/);
  await payout.getByRole("link", { name: "売上受取設定を始める" }).click();
  await page.waitForURL(/\/store\/payouts$/);
  await expect(page.getByTestId("payout-summary")).toContainText("売上を受け取るための設定です");

  // 3〜4. 商品は登録済み。公開できない理由は具体的に
  await page.goto("/store/start");
  await expect(page.getByTestId("onboarding-step-product")).toHaveAttribute("data-done", "yes");
  await expect(page.getByTestId("onboarding-step-publish").getByTestId("onboarding-step-status")).toContainText("売上受取設定を完了してください");

  // 5. 受取の流れ（モニター）。開くと完了
  const monitor = page.getByTestId("onboarding-step-monitor");
  if ((await monitor.getAttribute("data-done")) === "no") {
    await expect(monitor).toContainText("商品をお渡しする");
    await monitor.getByRole("link", { name: "受取の流れを確認する" }).click();
    await page.waitForURL(/\/store\/monitor$/);
  } else {
    await page.goto("/store/monitor");
  }
  await expect(page.getByTestId("store-monitor")).toBeVisible();

  // 中断 → 再開: 別の画面に移ってから戻っても、現在の状態から同じ進捗
  await page.goto("/store/start");
  const now = await progressDone(page);
  await expect(page.getByTestId("onboarding-step-monitor")).toHaveAttribute("data-done", "yes");
  await page.goto("/store/products");
  await page.goto("/store/start");
  expect(await progressDone(page)).toBe(now);
});

test("PC: 5/5 完了で「準備ができました！」。ダッシュボードでは小さく「導入準備 5 / 5 完了」", async ({ browser, page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminCtx.newPage();
  await demoLogin(admin, "admin");
  await admin.goto("/admin/stores");
  await admin.getByRole("link", { name: "札幌スイーツラボ" }).first().click();
  await admin.waitForURL(/\/admin\/stores\/[0-9a-f-]+$/);
  const storeUrl = admin.url();
  await admin.locator("#userId").fill(OWNER_ID);
  await admin.locator("#role").selectOption("owner");
  await admin.getByRole("button", { name: "追加する" }).click();
  await expect(admin.getByText("メンバーを追加しました。")).toBeVisible();
  try {
    await demoLogin(page, "storeOwner");
    await page.goto("/store");
    await page.locator("#store-switch").selectOption({ label: "札幌スイーツラボ" });
    await page.getByRole("button", { name: "切替" }).click();
    await expect(page.getByRole("banner")).toContainText("札幌スイーツラボ");
    await fillStoreInfo(page, "札幌スイーツラボ");
    await page.goto("/store/monitor");
    await expect(page.getByTestId("store-monitor")).toBeVisible();
    await page.goto("/store/start");
    await expect(page.getByTestId("onboarding-step-payout")).toHaveAttribute("data-done", "yes");
    await expect(page.getByTestId("onboarding-step-payout")).toContainText("売上受取設定 完了");
    const done = page.getByTestId("onboarding-complete");
    await expect(done).toContainText("TABETUNAGU を始める準備ができました！");
    await expect(done).toContainText("余ったら出品。売れたら渡すだけ。");
    await expect(done.getByRole("link", { name: "商品を出品する" })).toBeVisible();
    await done.getByRole("link", { name: "店舗ダッシュボードへ" }).click();
    await page.waitForURL(/\/store$/);
    const compact = page.getByTestId("store-readiness");
    await expect(compact).toHaveAttribute("data-complete", "yes");
    await expect(compact).toContainText("導入準備 5 / 5 完了");
  } finally {
    await admin.goto(storeUrl);
    await admin.locator("li").filter({ hasText: "大通ベーカリー 店主" }).getByRole("button", { name: "外す" }).click();
    await expect(admin.locator("li").filter({ hasText: "大通ベーカリー 店主" })).toHaveCount(0);
    await adminCtx.close();
  }
});

test("スタッフ: 売上受取設定・プランは前面に出さない。受取・モニター中心", async ({ page }) => {
  await demoLogin(page, "storeStaff");
  await page.goto("/store/start");
  const payout = page.getByTestId("onboarding-step-payout");
  await expect(payout).toContainText("店舗オーナーが設定します");
  await expect(payout.getByRole("link")).toHaveCount(0);
  await expect(page.locator('a[href="/store/payouts"]')).toHaveCount(0);
  await page.goto("/store/help");
  await expect(page.getByTestId("store-help")).toHaveAttribute("data-role", "staff");
  await expect(page.getByTestId("help-owner")).toHaveCount(0);
  await expect(page.getByTestId("help-emergency")).toHaveCount(0);
  await expect(page.getByTestId("help-flow").locator("li")).toHaveCount(5);
  await expect(page.getByTestId("help-faq")).toContainText("通知音が鳴りません。");
  await expect(page.getByTestId("help-trouble")).not.toContainText("売上受取設定");
});

test("使い方（オーナー）: 「売れたら、渡すだけ。」・受取の流れ・FAQ・困ったとき。店頭QRは「緊急時の受取対応」の中だけ", async ({ page }) => {
  await demoLogin(page, "storeOwner");
  await page.goto("/store/help");
  await expect(page.getByTestId("help-hero")).toContainText("売れたら、渡すだけ。");
  const flow = page.getByTestId("help-flow").locator("li");
  await expect(flow).toHaveCount(5);
  await expect(flow.nth(2)).toContainText("商品をお渡しする");
  await expect(flow.nth(3)).toContainText("商品を受け取ったお客様が、ご自身の画面でスワイプ");
  await expect(flow.nth(4)).toContainText("受取完了");
  const faq = page.getByTestId("help-faq").locator("details");
  expect(await faq.count()).toBeGreaterThanOrEqual(5);
  await faq.filter({ hasText: "お客様が来なかったら？" }).locator("summary").click();
  await expect(page.getByTestId("help-faq").getByRole("link", { name: "キャンセルポリシー" })).toBeVisible();
  for (const t of ["商品を公開停止したい", "注文をキャンセルしたい", "店舗モニターが更新されない", "売上受取設定を確認したい"]) {
    await expect(page.getByTestId("help-trouble")).toContainText(t);
  }
  // 店頭QRは通常の導線（メニュー）に出さず、折りたたみの中だけ
  await expect(page.getByRole("navigation").getByRole("link", { name: /QR/ })).toHaveCount(0);
  const emergency = page.getByTestId("help-emergency");
  await expect(emergency).not.toHaveAttribute("open", "");
  await emergency.locator("summary").click();
  await expect(emergency.getByRole("link", { name: "店頭QRコード（障害時用）" })).toBeVisible();
});
