import { expect, test, type Page } from "@playwright/test";

/** 購入確認（決済直前）。機能フラグ ON・幅 375px。Stripe には通信しない（この環境では Stripe 未設定） */
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

/** 購入ボタンが画面の最下部に固定され、画面内に収まっている（購入確認では下部ナビを出さない） */
async function expectStickyAtBottom(page: Page) {
  await expect(page.getByRole("navigation", { name: "メインメニュー" })).toHaveCount(0);
  const bar = (await page.getByTestId("buy-sticky").boundingBox())!;
  const vh = page.viewportSize()!.height;
  expect(bar.y + bar.height).toBeLessThanOrEqual(vh + 1);
  expect(bar.y).toBeGreaterThan(vh / 2);
}

test("商品詳細 →「食べつなぐ」→ ログイン → 注文内容の確認: 商品・数量・受取・内訳・30pt・キャンセル・決済後の流れ・合計入りのボタン", async ({ page }) => {
  await openProduct(page, "sapporo-sweets-lab", /ケーキの食べつなぎBOX/);
  await page.getByTestId("product-cta").click();
  await page.waitForURL(/\/login\?next=/);
  await page.locator('form:has(input[value="user"]) button').click();
  await page.waitForURL(/\/products\/[0-9a-f-]+\/buy$/);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("注文内容の確認");
  const product = page.getByTestId("buy-product");
  await expect(product).toContainText("ケーキの食べつなぎBOX");
  await expect(product).toContainText("食べつなぎBOX");
  await expect(product).toContainText("札幌スイーツラボ");
  await expect(product).toContainText("1,200円 / 1BOX");
  await expect(page.getByTestId("buy-quantity")).toHaveText("1BOX");

  const pickup = page.getByTestId("buy-pickup");
  await expect(pickup).toContainText("受取時間");
  await expect(pickup).toContainText(/\d{2}:\d{2}〜\d{2}:\d{2}/);
  await expect(pickup).toContainText("札幌スイーツラボ");

  const summary = page.getByTestId("buy-summary");
  await expect(summary).toContainText("商品小計1,200円");
  await expect(summary).toContainText("つなぐチャージ30円");
  await expect(summary).toContainText("お支払い合計1,230円");
  await expect(page.getByTestId("points-note")).toHaveText("お支払い完了後、この注文で30ptを付与します。");
  await expect(page.getByTestId("payment-method")).toHaveText("お支払いはオンラインで完了します。店頭でのお会計はありません。");
  await expect(page.getByTestId("cancellation-note")).toContainText("決済後5分以内かつ受取開始前までキャンセル可能です。");
  await expect(page.getByTestId("after-payment")).toContainText("受取チケットが発行されます");
  await expect(page.locator("main")).not.toContainText(/予約確認|レジ|QR決済|店頭会計|実質無料/);

  const pay = page.getByTestId("buy-submit");
  await expect(pay).toHaveText("1,230円で食べつなぐ");
  await expectStickyAtBottom(page);
  await expectNoHorizontalScroll(page);

  // 数量を変えると内訳と購入ボタンの合計が変わる（つなぐチャージは1注文ごと）
  await page.getByRole("button", { name: "数量を増やす" }).click();
  await expect(page.getByTestId("buy-quantity")).toHaveText("2BOX");
  await expect(summary).toContainText("商品小計2,400円");
  await expect(summary).toContainText("つなぐチャージ30円");
  await expect(summary).toContainText("お支払い合計2,430円");
  await expect(pay).toHaveText("2,430円で食べつなぐ");
  await page.getByRole("button", { name: "数量を減らす" }).click();
  await expect(pay).toHaveText("1,230円で食べつなぐ");

  // Stripe 未設定の環境: 決済画面に進まず、技術的なコードではない文言を出す。最下部までスクロールしてもボタンは見える
  await pay.click();
  await expect(page.getByTestId("buy-error")).toHaveText("現在オンライン決済を利用できません。時間をおいてお試しください。");
  await expect(page.getByTestId("buy-error")).toHaveAttribute("role", "alert");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(pay).toBeInViewport();
});

test("売り切れ・購入準備中は購入ボタンを無効にし、理由を出す", async ({ page }) => {
  await demoLogin(page, "user");
  await openProduct(page, "sosei-delicatessen", /デリの食べつなぎBOX/);
  await page.goto(`${page.url()}/buy`);
  await expect(page.getByTestId("buy-unavailable")).toHaveText("申し訳ありません。この商品は売り切れました。");
  await expect(page.getByTestId("buy-disabled")).toHaveText("売り切れ");
  await expect(page.getByTestId("buy-disabled")).toBeDisabled();
  await expect(page.getByTestId("buy-submit")).toHaveCount(0);
  await expectStickyAtBottom(page);

  await openProduct(page, "kita-obento", /./);
  await page.goto(`${page.url()}/buy`);
  await expect(page.getByTestId("buy-unavailable")).toHaveText("現在この店舗の商品は購入準備中です。");
  await expect(page.getByTestId("buy-disabled")).toHaveText("購入準備中");
  await expect(page.getByTestId("buy-submit")).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});
