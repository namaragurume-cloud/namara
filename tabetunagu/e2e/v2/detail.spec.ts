import { expect, test, type Page } from "@playwright/test";

/** 商品詳細（購入判断）。機能フラグ ON・幅 375px。Stripe には通信しない */
async function demoLogin(page: Page, account: "user" | "storeOwner") {
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

async function openProduct(page: Page, storeSlug: string, name: RegExp) {
  await page.goto(`/stores/${storeSlug}`);
  await page.locator('main a[href^="/products/"]').filter({ hasText: name }).first().click();
  await page.waitForURL(/\/products\/[0-9a-f-]+$/);
}

async function expectNoHorizontalScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

/** 固定の購入ボタンが下部ナビの上にあり、画面内に収まっている */
async function expectStickyAboveNav(page: Page) {
  const cta = (await page.getByTestId("sticky-cta").boundingBox())!;
  const nav = (await page.getByRole("navigation", { name: "メインメニュー" }).boundingBox())!;
  expect(cta.y + cta.height).toBeLessThanOrEqual(nav.y + 1);
  expect(cta.y).toBeGreaterThan(0);
}

function jstClockAfter(minutes: number) {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
  const now = fmt.format(new Date());
  const later = fmt.format(new Date(Date.now() + minutes * 60_000));
  return later < now ? "23:59" : later;
}

test("BOX 商品: 画像・価格・○円相当・お得率/お得額・残り・受取時間・支払い合計・チャージ・30pt・固定の購入ボタン", async ({ page }) => {
  await openProduct(page, "sapporo-sweets-lab", /ケーキの食べつなぎBOX/);
  await expect(page.getByRole("img", { name: "ケーキの食べつなぎBOX" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("ケーキの食べつなぎBOX");

  const price = page.getByTestId("detail-price");
  await expect(price).toContainText("1,200円");
  await expect(price).toContainText("2,400円相当");
  await expect(page.getByTestId("detail-discount")).toHaveText("50%OFF");
  await expect(page.getByTestId("detail-saving")).toHaveText("1,200円おトク");
  await expect(page.getByTestId("detail-remaining")).toHaveText("残り3BOX");
  await expect(page.getByTestId("detail-pickup")).toContainText(/\d{2}:\d{2}〜\d{2}:\d{2}/);

  // BOX: ラベル・○円相当 → 価格・中身は当日のお楽しみ
  await expect(page.getByText("食べつなぎBOX", { exact: true })).toBeVisible();
  await expect(page.getByTestId("box-note")).toContainText("2,400円相当 → 1,200円");
  await expect(page.getByTestId("box-note")).toContainText("中身は当日のお楽しみ");

  // ファーストビュー（固定の購入ボタンより上）に価格・お得率・受取時間・残りがある
  const ctaTop = (await page.getByTestId("sticky-cta").boundingBox())!.y;
  for (const id of ["detail-price", "detail-discount", "detail-pickup", "detail-remaining"]) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(box.y + box.height, id).toBeLessThanOrEqual(ctaTop);
  }

  // 支払い合計（商品価格 + つなぐチャージ）と 30pt
  const breakdown = page.getByTestId("price-breakdown");
  await expect(breakdown).toContainText("商品価格1,200円");
  await expect(breakdown).toContainText("つなぐチャージ30円");
  await expect(page.getByTestId("detail-total")).toHaveText("1,230円");
  await expect(page.getByTestId("charge-note")).toHaveText("つなぐチャージ30円につき、30ptを付与します。");
  await expect(page.locator("main")).not.toContainText(/実質無料|30円得/);

  // 受け取り方・キャンセル（platform_settings の分数）
  await expect(page.getByTestId("pickup-guide")).toContainText("スタッフへ受取チケットをご提示ください");
  await expect(page.getByTestId("pickup-guide")).toContainText("決済後5分以内かつ受取開始前までキャンセル可能です。");

  // 固定の購入ボタン: 支払い合計入り・30pt付与・下部ナビに被らない・スクロールしても見える
  const cta = page.getByTestId("product-cta");
  await expect(cta).toHaveText("1,230円で食べつなぐ");
  await expect(page.getByTestId("sticky-cta")).toContainText("30pt付与");
  await expectStickyAboveNav(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(cta).toBeInViewport();
  await expectStickyAboveNav(page);
  await expectNoHorizontalScroll(page);
});

test("購入ボタン → 購入確認（ログイン済み）。キーボードでも操作できる", async ({ page }) => {
  await demoLogin(page, "user");
  await openProduct(page, "sapporo-sweets-lab", /ケーキの食べつなぎBOX/);
  const cta = page.getByRole("link", { name: "1,230円で食べつなぐ" });
  await cta.focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/products\/[0-9a-f-]+\/buy$/);
  await expect(page.getByTestId("buy-summary")).toContainText("お支払い合計1,230");
});

test("売り切れ・購入準備中（Connect 未完了）", async ({ page }) => {
  await openProduct(page, "sosei-delicatessen", /デリの食べつなぎBOX/);
  await expect(page.getByTestId("product-cta")).toHaveText("売り切れ");
  await expect(page.getByTestId("detail-remaining")).toHaveText("売り切れ");
  await expect(page.getByTestId("price-breakdown")).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  await openProduct(page, "kita-obento", /./);
  await expect(page.getByTestId("product-cta")).toHaveText("購入準備中");
  await expect(page.getByText("現在この店舗の商品は購入準備中です。")).toBeVisible();
  await expect(page.getByTestId("price-breakdown")).toBeVisible();
  await expectStickyAboveNav(page);
});

test("在庫1は「残り1つ」、受取終了が近いと「受取終了まであと○分」。この店舗のほかの商品", async ({ browser, page }) => {
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const owner = await ownerCtx.newPage();
  await demoLogin(owner, "storeOwner");
  await owner.goto("/store/products/new");
  await owner.getByLabel("商品名").fill("E2E残り1つのパン");
  await owner.getByLabel("通常価格（相当）").fill("500");
  await owner.getByLabel("食べつなぎ価格").fill("300");
  await owner.getByLabel("数量").fill("1");
  await owner.getByLabel("受取開始").fill("00:00");
  await owner.getByLabel("受取終了").fill(jstClockAfter(40));
  await owner.getByRole("button", { name: "確認して公開する" }).click();
  await owner.waitForURL(/\/store\?published=/);
  await ownerCtx.close();

  await openProduct(page, "odori-bakery", /E2E残り1つのパン/);
  await expect(page.getByTestId("detail-remaining")).toHaveText("残り1つ");
  await expect(page.getByTestId("detail-deadline")).toHaveText(/^受取終了まであと\d+分$/);
  await expect(page.getByTestId("detail-saving")).toHaveText("200円おトク");
  await expect(page.getByTestId("related")).toBeVisible();
  await expect(page.getByTestId("related").getByTestId("deal-row").first()).toBeVisible();
  await expectNoHorizontalScroll(page);
});
