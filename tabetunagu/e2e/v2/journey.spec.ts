import { expect, test, type Page } from "@playwright/test";

/**
 * 機能フラグ ON（ENABLE_V2_CHECKOUT=true）・幅 375px での v2 の購入〜受取の導線。
 * Stripe には通信しない: Checkout は「決済を開始できない（Stripe 未設定）」までを確認し、
 * 決済済みの注文はデモデータ（seedDemoOrders）を使う。
 */
async function demoLogin(page: Page, account: "user" | "storeOwner") {
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectInViewport(page: Page, testId: string) {
  const box = (await page.getByTestId(testId).boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
}

async function openProduct(page: Page, storeSlug: string, name: RegExp) {
  await page.goto(`/stores/${storeSlug}`);
  await page.locator('main a[href^="/products/"]').filter({ hasText: name }).first().click();
  await page.waitForURL(/\/products\/[0-9a-f-]+$/);
}

test("商品詳細 →「食べつなぐ」→ ログイン → 購入確認（小計・つなぐチャージ・合計・ポイント）に戻る", async ({ page }) => {
  await page.goto("/products");
  await expectNoHorizontalScroll(page);
  await openProduct(page, "sapporo-sweets-lab", /ケーキの食べつなぎBOX/);

  // 商品詳細（v2）
  await expect(page.getByText("2,400円相当 → 1,200円")).toBeVisible();
  await expect(page.getByTestId("charge-note")).toContainText("つなぐチャージ30円につき、30ptを付与します。");
  await expect(page.getByText("お支払いは事前にオンラインで。")).toBeVisible();
  const cta = page.getByTestId("product-cta");
  await expect(cta).toHaveText("食べつなぐ");
  await expectInViewport(page, "product-cta");
  await expectNoHorizontalScroll(page);
  const productUrl = page.url();

  // 未ログイン → ログイン → 購入確認へ戻る（ホームへ飛ばさない）
  await cta.click();
  await page.waitForURL(/\/login\?next=/);
  await page.locator('form:has(input[value="user"]) button').click();
  await page.waitForURL(/\/products\/[0-9a-f-]+\/buy$/);
  expect(page.url()).toBe(`${productUrl}/buy`);

  // 購入確認
  const summary = page.getByTestId("buy-summary");
  await expect(summary).toContainText("商品小計1,200円");
  await expect(summary).toContainText("つなぐチャージ30円");
  await expect(summary).toContainText("お支払い合計1,230");
  await expect(page.getByTestId("points-note")).toHaveText("つなぐチャージ30円につき、30ptを付与します。");
  const pay = page.getByRole("button", { name: "1,230円で食べつなぐ" });
  await expect(pay).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Stripe 未設定の環境では Checkout を開始せず、在庫も押さえない（Stripe には通信しない）
  await pay.click();
  await expect(page.getByText("現在オンライン決済を利用できません。")).toBeVisible();
  await page.goto(productUrl);
  await expect(page.getByText("残り3BOX").first()).toBeVisible();
});

test("売上受取設定が未完了の店舗は「購入準備中」、売り切れは「売り切れ」（商品は掲載したまま）", async ({ page }) => {
  await openProduct(page, "kita-obento", /./);
  await expect(page.getByTestId("product-cta")).toHaveText("購入準備中");
  await expect(page.getByText("現在この店舗の商品は購入準備中です。")).toBeVisible();

  await openProduct(page, "sosei-delicatessen", /デリの食べつなぎBOX/);
  await expect(page.getByTestId("product-cta")).toHaveText("売り切れ");
});

test("注文 → 受取チケット → スワイプ → 受取完了 → 店舗モニターに反映（375px）", async ({ browser, page }) => {
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const owner = await ownerCtx.newPage();
  await demoLogin(owner, "storeOwner");
  await owner.goto("/store/monitor");
  await expect(owner.getByTestId("monitor-section-active").getByText("受取チケットのデモBOX×1")).toBeVisible();

  await demoLogin(page, "user");
  // ナビ: v2 では「注文」「お気に入り」
  const nav = page.getByRole("navigation", { name: "メインメニュー" });
  await expect(nav.getByRole("link", { name: "注文" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "お気に入り" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "予約" })).toHaveCount(0);
  await nav.getByRole("link", { name: "注文" }).click();
  await page.waitForURL(/\/orders/);
  await page.getByRole("link", { name: /受取チケットのデモBOX/ }).click();

  await expect(page.getByTestId("pickup-ticket")).toBeVisible();
  await expectInViewport(page, "pickup-ticket");
  await expectInViewport(page, "pickup-swipe-track");
  await expectNoHorizontalScroll(page);
  // スワイプ操作が下部メニューに隠れない
  const track = (await page.getByTestId("pickup-swipe-track").boundingBox())!;
  const navBox = (await nav.boundingBox())!;
  expect(track.y + track.height).toBeLessThanOrEqual(navBox.y);

  const knob = (await page.getByTestId("pickup-swipe-knob").boundingBox())!;
  await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width - 4, knob.y + knob.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId("pickup-done")).toBeVisible();

  await expect(owner.getByTestId("monitor-section-picked_up").getByText("受取チケットのデモBOX×1")).toBeVisible({ timeout: 8000 });
  await ownerCtx.close();
});

test("マイページ: ポイント（台帳）と注文履歴への導線", async ({ page }) => {
  await demoLogin(page, "user");
  await page.goto("/me");
  await expect(page.getByTestId("my-points")).toBeVisible();
  await expect(page.getByRole("link", { name: "受取待ちの注文（受取チケット）" })).toBeVisible();
  await expect(page.getByRole("link", { name: "過去の予約" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
