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
