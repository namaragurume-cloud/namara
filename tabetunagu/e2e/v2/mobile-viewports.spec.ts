import { expect, test, type Page } from "@playwright/test";

/**
 * LINE ミニアプリ / スマホの主要な幅（375 / 390 / 430）で重要画面が崩れないこと。
 * 実機（iOS / Android の LINE 内・Safari / Chrome）の確認の代わりではない（POC_GO_LIVE_CHECKLIST.md の実機チェックは人が行う）。
 */
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

async function demoLogin(page: Page, account: "user") {
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

async function expectNoHorizontalScroll(page: Page) {
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

/** 要素が画面内（下端・左右）に収まり、下部メニューと重ならない */
async function expectInView(page: Page, testId: string) {
  const box = (await page.getByTestId(testId).boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
  const nav = page.getByRole("navigation", { name: "メインメニュー" });
  if (await nav.isVisible()) {
    const n = (await nav.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(n.y + 1);
  }
}

async function openCake(page: Page) {
  await page.goto("/stores/sapporo-sweets-lab");
  await page.locator('main a[href^="/products/"]').filter({ hasText: /ケーキの食べつなぎBOX/ }).first().click();
  await page.waitForURL(/\/products\/[0-9a-f-]+$/);
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp });

    test("未ログイン: ホーム → 商品詳細（固定の購入ボタン）→ ログイン → 購入確認へ戻る", async ({ page }) => {
      await page.goto("/");
      await expectNoHorizontalScroll(page);
      for (const link of await page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link").all()) {
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      await openCake(page);
      await expectNoHorizontalScroll(page);
      await expect(page.getByTestId("detail-price")).toBeVisible();
      await expect(page.getByTestId("detail-total")).toBeVisible();
      await expectInView(page, "sticky-cta");
      const cta = page.getByTestId("sticky-cta").getByRole("link").first();
      expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await cta.click();
      await page.waitForURL(/\/login\?next=/);
      const next = new URL(page.url()).searchParams.get("next")!;
      expect(next).toMatch(/^\/products\/[0-9a-f-]+\/buy$/);
      await expectNoHorizontalScroll(page);
      await page.locator('form:has(input[value="user"]) button').click();
      await page.waitForURL((url) => url.pathname === next);
      await expect(page.getByTestId("buy-summary")).toBeVisible();
    });

    test("購入確認: 小計・チャージ・合計・30pt・キャンセル条件。ボタンは画面内。通信できないときは送信しない", async ({ page, context }) => {
      await demoLogin(page, "user");
      await openCake(page);
      await page.getByTestId("sticky-cta").getByRole("link").first().click();
      await page.waitForURL(/\/buy$/);
      await expectNoHorizontalScroll(page);
      await expect(page.getByTestId("buy-summary")).toContainText("つなぐチャージ");
      await expect(page.getByTestId("points-note")).toContainText("30pt");
      await expectInView(page, "buy-sticky");
      await context.setOffline(true);
      await page.getByTestId("buy-submit").click();
      await expect(page.getByTestId("buy-offline")).toHaveText("通信状況を確認して、もう一度お試しください。");
      expect(new URL(page.url()).pathname).toMatch(/\/buy$/);
      await context.setOffline(false);
    });

    test("注文: 決済確認中（Stripe から戻った直後）・キャンセルから戻ったとき・受取チケット / 受取完了", async ({ page }) => {
      await demoLogin(page, "user");
      await page.goto("/orders?tab=other");
      await page.getByTestId("order-card").filter({ hasText: "お支払い待ちのデモBOX" }).click();
      await page.waitForURL(/\/orders\/[0-9a-f-]+$/);
      const orderUrl = page.url();
      // Stripe から戻った直後: paid になるまで「確認しています」（リダイレクトだけでは paid にしない）
      await page.goto(`${orderUrl}?from=checkout`);
      await expect(page.getByRole("heading", { name: "お支払いを確認しています" })).toBeVisible();
      await expect(page.getByText("この画面は自動で更新されます。")).toBeVisible();
      await expectNoHorizontalScroll(page);
      // Checkout でキャンセルして戻ったとき: 「決済を続ける」（新しい注文は作らない）
      await page.goto(`${orderUrl}?from=cancel`);
      await expect(page.getByRole("heading", { name: "お支払い待ち" })).toBeVisible();
      await expect(page.getByRole("button", { name: /お支払いへ進む/ })).toBeVisible();

      // 受取チケット（受取待ち or 受取完了）: 支払い済み・商品・受取時間・注文番号が最初の画面に入る
      await page.goto("/orders");
      await page.getByTestId("order-card").filter({ hasText: "受取チケットのデモBOX" }).click();
      await page.waitForURL(/\/orders\/[0-9a-f-]+$/);
      await expectNoHorizontalScroll(page);
      for (const id of ["ticket-paid", "ticket-time", "ticket-items", "ticket-order-number"]) await expectInView(page, id);
      const status = await page.getByTestId("order-page").getAttribute("data-status");
      if (status === "picked_up") {
        await expect(page.getByTestId("pickup-done")).toContainText("食べつなぎました");
      } else {
        await expect(page.getByTestId("pickup-swipe-knob")).toBeVisible();
        const knob = (await page.getByTestId("pickup-swipe-knob").boundingBox())!;
        expect(knob.height).toBeGreaterThanOrEqual(44);
      }
    });
  });
}

test("横画面でも致命的に崩れない（ホーム・商品詳細）", async ({ page }) => {
  await page.setViewportSize({ width: 812, height: 375 });
  await page.goto("/");
  await expectNoHorizontalScroll(page);
  await openCake(page);
  await expectNoHorizontalScroll(page);
  await expect(page.getByTestId("sticky-cta")).toBeVisible();
});
