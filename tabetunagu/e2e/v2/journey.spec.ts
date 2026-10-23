import { expect, test, type Page } from "@playwright/test";

/**
 * 機能フラグ ON（ENABLE_V2_CHECKOUT=true）・幅 375px での v2 の購入〜受取の導線。
 * Stripe には通信しない: Checkout は「決済を開始できない（Stripe 未設定）」までを確認し、
 * 決済済みの注文はデモデータ（seedDemoOrders）を使う。
 */
async function demoLogin(page: Page, account: "user" | "storeOwner" | "storeStaff") {
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
  await expect(page.getByTestId("pickup-guide")).toContainText("オンラインで事前決済");
  // 受け取り方の案内は v2 の文言だけ（旧フローの「レジ」「QR」「お会計になります」は出さない）
  await expect(page.getByTestId("pickup-guide")).toContainText("スタッフへ受取チケットをご提示ください");
  await expect(page.getByTestId("pickup-guide")).toContainText("店頭でのお会計はありません。");
  await expect(page.getByText(/TABETUNAGUの予約です|店頭のQRを読み取って|お会計になります/)).toHaveCount(0);
  const cta = page.getByTestId("product-cta");
  await expect(cta).toHaveText("1,230円で食べつなぐ");
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
  await expect(page.getByTestId("points-note")).toHaveText("お支払い完了後、この注文で30ptを付与します。");
  await expect(page.getByTestId("cancellation-note")).toContainText("決済後5分以内かつ受取開始前までキャンセル可能です。");
  await expect(page.getByTestId("cancellation-note").getByRole("link", { name: "キャンセルポリシー" })).toBeVisible();
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
  await expect(owner.getByTestId("monitor-section-active").getByText(/受取チケットのデモBOX/)).toBeVisible();

  await demoLogin(page, "user");
  // ナビ: v2 では「注文」「お気に入り」
  const nav = page.getByRole("navigation", { name: "メインメニュー" });
  await expect(nav.getByRole("link", { name: "注文" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "お気に入り" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "予約" })).toHaveCount(0);
  await nav.getByRole("link", { name: "注文" }).click();
  await page.waitForURL(/\/orders/);
  // 注文一覧の「受取待ち」→ 受取チケット
  await expect(page.getByRole("tab", { name: "受取待ち" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: /受取チケットのデモBOX/ }).click();

  // チケット: 支払い済み・受取時間・商品・注文番号・スタッフへの案内・スワイプ前の注意
  const ticket = page.getByTestId("pickup-ticket");
  await expect(ticket.getByRole("heading", { name: "受取チケット" })).toBeVisible();
  await expect(page.getByTestId("ticket-paid")).toHaveText("支払い済み");
  await expect(page.getByTestId("ticket-time")).toContainText(/\d{2}:\d{2}〜\d{2}:\d{2}/);
  await expect(page.getByTestId("ticket-items")).toHaveText("受取チケットのデモBOX ×1");
  await expect(page.getByTestId("ticket-order-number")).toHaveText(/^#[0-9A-Z]{6}$/);
  await expect(ticket).toContainText("店舗スタッフへこの画面をお見せください。");
  await expect(ticket).toContainText("商品を受け取ったら、ご自身で下のスライダーを操作してください。");
  await expect(page.getByTestId("ticket-swipe-caution")).toHaveText("商品を受け取ってから操作してください。");
  await expect(page.getByTestId("pickup-swipe-label")).toHaveText("右へスワイプして受取完了");
  await expectNoHorizontalScroll(page);
  // チケットでは下部ナビを出さない。スワイプはスクロールせずに見える（375 × 740）
  await expect(nav).toBeHidden();
  await expectInViewport(page, "pickup-swipe-track");
  const track = (await page.getByTestId("pickup-swipe-track").boundingBox())!;
  expect(track.y + track.height).toBeLessThanOrEqual(740);

  // タップだけ・途中まででは受取完了にならない
  await page.getByTestId("pickup-swipe-knob").click();
  await page.waitForTimeout(400);
  await expect(page.getByTestId("pickup-status")).toHaveText("受取待ち");
  let knob = (await page.getByTestId("pickup-swipe-knob").boundingBox())!;
  await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width * 0.6, knob.y + knob.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("pickup-status")).toHaveText("受取待ち");
  await expect(page.getByTestId("pickup-swipe")).toHaveAttribute("data-phase", "idle");

  // 右端までスワイプ → picked_up → 完了表示（スワイプは消え、再操作できない）
  knob = (await page.getByTestId("pickup-swipe-knob").boundingBox())!;
  await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width - 4, knob.y + knob.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId("pickup-done")).toBeVisible();
  await expect(page.getByTestId("pickup-done")).toContainText("食べつなぎました！");
  await expect(page.getByTestId("pickup-done")).toContainText("このおいしさが、次の食につながりました。");
  await expect(page.getByTestId("pickup-status")).toHaveText("受取完了");
  await expect(page.getByTestId("ticket-picked-up-at")).toContainText("受取完了：");
  await expect(page.getByTestId("pickup-swipe-knob")).toHaveCount(0);
  await expect(page.getByTestId("ticket-guide")).toHaveCount(0);

  // 店舗モニターに自動で反映（再読み込みしない）。新しい受取完了は「✓ 受取完了」で約10秒強調し、通知は1回
  const doneCard = owner.getByTestId("monitor-section-picked_up").getByTestId("monitor-card").filter({ hasText: "受取チケットのデモBOX" });
  await expect(doneCard).toBeVisible({ timeout: 8000 });
  await expect(doneCard).toHaveAttribute("data-highlight", "on");
  await expect(doneCard.getByTestId("monitor-card-status")).toHaveText("✓ 受取完了");
  await expect(owner.getByTestId("store-monitor")).toHaveAttribute("data-chimes", "1");
  await expect(doneCard).toHaveAttribute("data-highlight", "off", { timeout: 13_000 });
  await expect(doneCard.getByTestId("monitor-card-status")).toHaveText(/^受取完了 \d{2}:\d{2}$/);
  await expect(owner.getByTestId("store-monitor")).toHaveAttribute("data-chimes", "1"); // 同じ注文で二度鳴らさない
  // 再読み込み後は、既にある受取完了を強調・通知しない
  await owner.reload();
  await expect(doneCard).toHaveAttribute("data-highlight", "off");
  await owner.waitForTimeout(2500);
  await expect(owner.getByTestId("store-monitor")).toHaveAttribute("data-chimes", "0");
  await ownerCtx.close();
});

test("マイページ: ポイント（台帳）と注文履歴への導線", async ({ page }) => {
  await demoLogin(page, "user");
  await page.goto("/me");
  await expect(page.getByTestId("my-points")).toBeVisible();
  await expect(page.getByRole("link", { name: "受取待ちの注文（受取チケット）" })).toBeVisible();
  await expect(page.getByRole("link", { name: "以前の方式でのご利用履歴" })).toBeVisible();
  await expect(page.getByRole("link", { name: /予約/ })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

/** v2 では旧フローの言葉（予約・QR・チェックイン・店頭/レジでの支払い・No Show・レスキュー）を通常の画面に出さない */
const LEGACY_WORDS = /予約|QR|チェックイン|店頭払い|店頭支払|レジで|お会計になります|お会計はいつもの|No ?Show|レスキュー/;

test("デモログイン: v2 の説明（受取チケット・スワイプ・受取モニター・未受取・決済状況）", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("商品を食べつないで、受取チケット・スワイプ完了まで確認")).toBeVisible();
  await expect(page.getByText("出品・注文・売上・受取モニターを確認")).toBeVisible();
  await expect(page.getByText("注文・受取状況・店舗モニターを確認")).toBeVisible();
  await expect(page.getByText("KPI・店舗・注文・未受取・決済状況を確認")).toBeVisible();
  expect(await page.locator("main").innerText()).not.toMatch(LEGACY_WORDS);
});

test("店舗画面: ダッシュボード・売上・設定・出品に旧フローの言葉を出さない（店頭QRは障害時用としてナビにだけ残す）", async ({ page }) => {
  await demoLogin(page, "storeOwner");
  await page.goto("/store");
  const nav = page.getByRole("navigation").first();
  await expect(page.getByRole("link", { name: "予約状況" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "QRコード（障害時用）" })).toBeAttached();
  await expect(nav).toBeAttached();
  expect(await page.locator("main").innerText()).not.toMatch(LEGACY_WORDS);
  await expect(page.getByText("受取モニターを見る")).toBeVisible();

  // 売上: 以前の方式の実績は折りたたみ（開かない限り表示しない）
  await page.goto("/store/sales");
  await expect(page.getByTestId("v2-sales")).toBeVisible();
  await expect(page.getByTestId("legacy-sales")).not.toHaveAttribute("open", "");
  expect(await page.getByTestId("v2-sales").innerText()).not.toMatch(LEGACY_WORDS);

  await page.goto("/store/settings");
  await expect(page.getByText("商品出品・LINE / Web 掲載・注文受付").first()).toBeVisible();
  await expect(page.getByPlaceholder(/レジ|予約/)).toHaveCount(0);

  for (const path of ["/store/products", "/store/products/new", "/store/orders", "/store/monitor"]) {
    await page.goto(path);
    expect(await page.locator("main").innerText(), path).not.toMatch(LEGACY_WORDS);
  }
});

test("店舗スタッフ: ダッシュボードに旧フローの言葉を出さない", async ({ page }) => {
  await demoLogin(page, "storeStaff");
  await page.goto("/store");
  expect(await page.locator("main").innerText()).not.toMatch(LEGACY_WORDS);
});

test("ユーザー画面: ホーム・商品一覧・注文・お気に入り・マイページに旧フローの言葉を出さない", async ({ page }) => {
  await demoLogin(page, "user");
  for (const path of ["/", "/products", "/orders", "/favorites", "/me"]) {
    await page.goto(path);
    expect(await page.locator("body").innerText(), path).not.toMatch(LEGACY_WORDS);
  }
});
