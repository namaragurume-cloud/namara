import { expect, test, type Page } from "@playwright/test";

/** ホーム（商品発見）。機能フラグ ON・幅 375px。Stripe には通信しない */
async function demoLogin(page: Page, account: "user" | "storeOwner") {
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** JST の「いま + minutes」を HH:MM で（日付をまたぐ場合は 23:59） */
function jstClockAfter(minutes: number) {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false });
  const now = fmt.format(new Date());
  const later = fmt.format(new Date(Date.now() + minutes * 60_000));
  return later < now ? "23:59" : later;
}

test("ファーストビュー: コピー・購入可能件数（エリアの合計と一致）・おすすめ・BOX・はじめての方へ・食品ロスの一文", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("近くのおいしいを、おトクに。");
  const count = page.getByTestId("available-count");
  await expect(count).toContainText(/いま\s*\d+\s*件、食べつなげます。/);
  await expect(count).toContainText("本日受取・在庫ありの商品");
  const total = Number((await count.innerText()).match(/いま\s*(\d+)/)![1]);
  expect(total).toBeGreaterThan(0);
  await expect(page.getByTestId("area-picker").getByRole("link", { name: /すべて/ })).toContainText(`${total}件`);

  // おすすめ: 写真・お得率・価格・○円相当・受取時間・残り
  const rec = page.getByTestId("home-recommended");
  await expect(rec.getByRole("heading", { name: "今日のおすすめ" })).toBeVisible();
  const card = rec.getByTestId("deal-card").first();
  await expect(card.getByTestId("deal-discount")).toHaveText(/^\d+%OFF$/);
  await expect(card).toContainText("円相当");
  await expect(card.getByTestId("deal-remaining")).toHaveText(/^残り(\d+(BOX|点)|1つ)$/);

  // BOX: BOX 表示・○円相当・残り
  const boxes = page.getByTestId("home-boxes");
  await expect(boxes.getByRole("heading", { name: "今日の食べつなぎBOX" })).toBeVisible();
  const box = boxes.getByTestId("deal-card").first();
  await expect(box).toContainText("食べつなぎBOX");
  await expect(box).toContainText("円相当");
  await expect(box.getByTestId("deal-remaining")).toBeVisible();

  // はじめての方へ（v2: QR・店頭のお会計は出さない）と食品ロスの一文
  await expect(page.getByTestId("first-time")).toContainText("受取チケット");
  await expect(page.getByTestId("first-time")).not.toContainText(/QR|レジ|予約/);
  await expect(page.getByTestId("food-loss-note")).toHaveText("おいしく食べつなぐことが、食品ロス削減にもつながります。");
  await expectNoHorizontalScroll(page);
});

test("エリア選択: 選択中が分かり、件数が絞り込まれる。カテゴリはエリアを引き継いで商品一覧へ", async ({ page }) => {
  await page.goto("/");
  const picker = page.getByTestId("area-picker");
  const odori = picker.getByRole("link", { name: /大通/ });
  const odoriCount = Number((await odori.innerText()).match(/(\d+)件/)![1]);
  await odori.click();
  await page.waitForURL(/\/\?area=odori$/);
  await expect(picker.getByRole("link", { name: /大通/ })).toHaveAttribute("aria-current", "true");
  await expect(picker.getByRole("link", { name: /すべて/ })).not.toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("available-count")).toContainText(`大通でいま${odoriCount}件、食べつなげます。`);
  for (const c of await page.getByTestId("deal-card").all()) await expect(c).toContainText("大通");
  await expectNoHorizontalScroll(page);

  await page.getByTestId("category-rail").getByRole("link", { name: "パン" }).click();
  await page.waitForURL(/\/products\?area=odori&category=bread$/);
  await expect(page.getByRole("heading", { name: "さがす" })).toBeVisible();
});

test("まもなく受取終了: 受取終了が近い商品を「あと○分」で出す", async ({ browser, page }) => {
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const owner = await ownerCtx.newPage();
  await demoLogin(owner, "storeOwner");
  await owner.goto("/store/products/new");
  await owner.getByLabel("商品名").fill("E2Eまもなく終了パン");
  await owner.getByLabel("通常価格（相当）").fill("600");
  await owner.getByLabel("食べつなぎ価格").fill("300");
  await owner.getByLabel("数量").fill("1");
  await owner.getByLabel("受取開始").fill("00:00");
  await owner.getByLabel("受取終了").fill(jstClockAfter(40));
  await owner.getByRole("button", { name: "確認して公開する" }).click();
  await owner.waitForURL(/\/store\?published=/);
  await ownerCtx.close();

  await page.goto("/");
  const section = page.getByTestId("home-ending-soon");
  await expect(section.getByRole("heading", { name: "まもなく受取終了" })).toBeVisible();
  const row = section.getByTestId("deal-row").filter({ hasText: "E2Eまもなく終了パン" });
  await expect(row.getByTestId("deal-row-deadline")).toHaveText(/^受取終了まであと\d+分$/);
  await expect(row.getByTestId("deal-remaining")).toHaveText("残り1つ");
  await expect(row).toContainText("50%OFF");
  await expect(row).toContainText("600円相当");
  // 同じ商品をおすすめにも重ねて出さない
  await expect(page.getByTestId("home-recommended").getByText("E2Eまもなく終了パン")).toHaveCount(0);
});

test("商品カード → 商品詳細（ホームから直接決済に進まない）。下部ナビに被らない", async ({ page }) => {
  await page.goto("/");
  const card = page.getByTestId("home-recommended").getByTestId("deal-card").first();
  const href = await card.getAttribute("href");
  expect(href).toMatch(/^\/products\/[0-9a-f-]+$/);
  await card.click();
  await page.waitForURL(/\/products\/[0-9a-f-]+$/);
  await expect(page.getByTestId("product-cta")).toBeVisible();

  // ホームの最後の要素までスクロールしても、下部ナビの上に表示される
  await page.goto("/");
  const note = page.getByTestId("food-loss-note");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const navTop = (await page.getByRole("navigation", { name: "メインメニュー" }).boundingBox())!.y;
  const noteBox = (await note.boundingBox())!;
  expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(navTop);
});
