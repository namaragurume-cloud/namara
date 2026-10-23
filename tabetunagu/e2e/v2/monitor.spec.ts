import { expect, test, type Page } from "@playwright/test";

/** 店舗モニター（店頭タブレット）。通信断・再接続・全画面 */
async function ownerLogin(page: Page) {
  await page.goto("/login");
  await page.locator('form:has(input[value="storeOwner"]) button').click();
  await page.waitForLoadState("networkidle");
}

test("通信に失敗しても表示中の注文を消さず「更新できません」と最終更新を出す。復旧すると接続中に戻る", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await ownerLogin(page);
  await page.goto("/store/monitor");
  const monitor = page.getByTestId("store-monitor");
  await expect(monitor).toHaveAttribute("data-connection", "ok");
  await expect(page.getByTestId("monitor-connection")).toContainText("接続中");
  await expect(page.getByTestId("monitor-last-synced")).toHaveText(/^最終更新 \d{2}:\d{2}$/);
  const cards = page.getByTestId("monitor-card");
  const before = await cards.count();
  expect(before).toBeGreaterThan(0);

  // 通信断
  await page.route("**/api/store/monitor**", (route) => route.abort("internetdisconnected"));
  await expect(monitor).toHaveAttribute("data-connection", /error|reconnecting/, { timeout: 8000 });
  await expect(page.getByTestId("monitor-connection")).toContainText(/更新できません。通信状況をご確認ください。|再接続しています…/);
  await expect(page.getByTestId("monitor-connection")).not.toContainText(/abort|ERR_|failed|500/i);
  await expect(cards).toHaveCount(before);
  await expect(page.getByTestId("monitor-last-synced")).toBeVisible();

  // 復旧 → 最新の状態に同期して接続中に戻る（過去の受取完了で通知しない）
  await page.unroute("**/api/store/monitor**");
  await expect(monitor).toHaveAttribute("data-connection", "ok", { timeout: 8000 });
  await expect(page.getByTestId("monitor-connection")).toContainText("接続中");
  await expect(cards).toHaveCount(before);
  await expect(monitor).toHaveAttribute("data-chimes", "0");
});

test("全画面モード: 店舗名・現在時刻・件数・注文番号を大きく。管理ナビを隠す", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await ownerLogin(page);
  await page.goto("/store/monitor");
  const normalSize = await page.getByTestId("monitor-count-active").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await page.getByTestId("monitor-kiosk").click();
  const monitor = page.getByTestId("store-monitor");
  await expect(monitor).toHaveAttribute("data-kiosk", "on");
  await expect(page.getByTestId("monitor-clock")).toHaveText(/^\d{2}:\d{2}$/);
  await expect(monitor).toContainText("今受取できます");
  await expect(monitor).toContainText("これから");
  await expect(monitor).toContainText("受取完了");
  await expect(monitor).toContainText("未受取");
  await expect(page.getByTestId("monitor-sound")).toBeVisible();
  await expect(page.getByTestId("monitor-connection")).toBeVisible();
  const kioskSize = await page.getByTestId("monitor-count-active").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(kioskSize).toBeGreaterThan(normalSize);
  // 全画面ではモニターが画面全体を覆い、管理ナビ（売上・設定など）は見えない
  const box = (await monitor.boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.width).toBe(1024);
  const navLink = (await page.getByRole("link", { name: "売上・手数料" }).boundingBox())!;
  const covered = await page.evaluate(
    ([x, y]) => Boolean(document.elementFromPoint(x, y)?.closest('[data-testid="store-monitor"]')),
    [navLink.x + navLink.width / 2, navLink.y + navLink.height / 2],
  );
  expect(covered).toBe(true);
});

test("最初の画面: 「本日の受取」・店舗名・4つの件数。カードに操作ボタンはなく、未受取は上部に小さく知らせる", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await ownerLogin(page);
  await page.goto("/store/monitor");
  const monitor = page.getByTestId("store-monitor");
  await expect(page.getByRole("heading", { level: 1, name: "本日の受取" })).toBeVisible();
  await expect(page.getByTestId("monitor-store-name")).toHaveText("大通ベーカリー");
  for (const phase of ["active", "upcoming", "picked_up", "unclaimed"]) {
    await expect(page.getByTestId(`monitor-count-${phase}`)).toHaveText(/^\d+件$/);
  }
  // 「今受取できます」がいちばん大きい
  const size = (id: string) => page.getByTestId(id).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(await size("monitor-count-active")).toBeGreaterThan(await size("monitor-count-upcoming"));
  // 区分の順番
  const order = await page.locator('[data-testid^="monitor-section-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  expect(order).toEqual(["monitor-section-active", "monitor-section-upcoming", "monitor-section-picked_up", "monitor-section-unclaimed"]);

  // デモの受取時間中の注文: 注文番号・商品・数量・時間・伏せ字の名前・「受取時間中」（色だけでなく文字でも）
  const active = page.getByTestId("monitor-section-active").getByTestId("monitor-card").filter({ hasText: "受取チケットのデモBOX" });
  await expect(active).toBeVisible();
  await expect(active.getByTestId("monitor-card-number")).toHaveText(/^#\S+$/);
  await expect(active).toContainText("×1");
  await expect(active).toContainText(/\d{2}:\d{2}〜\d{2}:\d{2}/);
  await expect(active).toContainText("＊");
  await expect(active.getByTestId("monitor-card-status")).toHaveText("受取時間中");
  // モニターには操作ボタン（受取完了・キャンセル・QR）を置かない
  await expect(monitor.getByTestId("monitor-card").locator("button, a")).toHaveCount(0);
  await expect(monitor).not.toContainText(/QR|キャンセル|受取完了にする/);

  // 受取時間を過ぎたデモ注文 → 未受取（上部に小さな案内）
  const unclaimed = Number((await page.getByTestId("monitor-count-unclaimed").textContent())!.replace("件", ""));
  if (unclaimed > 0) {
    await expect(page.getByTestId("monitor-unclaimed-alert")).toContainText(`未受取が${unclaimed}件あります`);
    await expect(page.getByTestId("monitor-section-unclaimed").getByTestId("monitor-card-status").first()).toHaveText("未受取");
  } else {
    await expect(page.getByTestId("monitor-unclaimed-alert")).toHaveCount(0);
  }
  await expect(page.getByText("売れたら、渡すだけ。")).toBeVisible();
});

test("通知音: 最初は OFF で「通知音をON」を目立たせ、押すと ON になる", async ({ page }) => {
  await ownerLogin(page);
  await page.goto("/store/monitor");
  const sound = page.getByTestId("monitor-sound");
  await expect(sound).toContainText("通知音をON");
  await sound.click();
  await expect(sound).toHaveText("通知音 ON");
});

test("全画面: 初回だけスタッフ向けの案内。画面スリープ防止が使えない端末でも動き、自動ロックOFFを案内する", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "wakeLock", { get: () => undefined, configurable: true });
  });
  await page.setViewportSize({ width: 1024, height: 768 });
  await ownerLogin(page);
  await page.goto("/store/monitor");
  await page.getByTestId("monitor-kiosk").click();
  await expect(page.getByTestId("store-monitor")).toHaveAttribute("data-kiosk", "on");
  await expect(page.getByTestId("monitor-guide")).toContainText("お客様の受取チケットを確認し、商品をお渡しください。");
  await expect(page.getByTestId("monitor-guide")).toContainText("受取完了はお客様が操作します。");
  await expect(page.getByTestId("wake-lock-status")).toContainText("非対応");
  await expect(page.getByTestId("wake-lock-status")).toContainText("端末の自動ロックをOFFにしてください");
  await expect(page.getByTestId("monitor-clock")).toBeVisible();
  // 2回目からは案内を出さない
  await page.getByTestId("monitor-kiosk").click();
  await page.getByTestId("monitor-kiosk").click();
  await expect(page.getByTestId("store-monitor")).toHaveAttribute("data-kiosk", "on");
  await expect(page.getByTestId("monitor-guide")).toHaveCount(0);
});

test("他店舗の注文は表示しない（すすきのデリのスタッフに大通ベーカリーのデモ注文は出ない）", async ({ page }) => {
  await page.goto("/login");
  await page.locator('form:has(input[value="storeStaff"]) button').click();
  await page.waitForLoadState("networkidle");
  await page.goto("/store/monitor");
  await expect(page.getByTestId("monitor-store-name")).not.toHaveText("大通ベーカリー");
  await expect(page.getByTestId("store-monitor")).not.toContainText("デモBOX");
});

test("通信が1回だけ失敗しても警告を出さない", async ({ page }) => {
  await ownerLogin(page);
  await page.goto("/store/monitor");
  const monitor = page.getByTestId("store-monitor");
  let failed = 0;
  await page.route("**/api/store/monitor**", (route) => (failed++ === 0 ? route.abort("internetdisconnected") : route.continue()));
  await expect.poll(() => failed, { timeout: 8000 }).toBeGreaterThanOrEqual(2);
  await expect(monitor).toHaveAttribute("data-connection", "ok");
  await expect(page.getByTestId("monitor-connection")).not.toContainText("更新できません");
});
