import { expect, test, type Page } from "@playwright/test";

/** 受取チケットの、受取できない状態（未受取・返金済み）と画面幅。決済済みのデモ注文は journey.spec でスワイプする */
async function demoLogin(page: Page) {
  await page.goto("/login");
  await page.locator('form:has(input[value="user"]) button').click();
  await page.waitForLoadState("networkidle");
}

async function openOrder(page: Page, name: RegExp, tabs: string[]) {
  for (const tab of tabs) {
    await page.goto(`/orders?tab=${tab}`);
    const link = page.getByRole("link", { name });
    if ((await link.count()) > 0) {
      await link.first().click();
      await page.waitForURL(/\/orders\/[0-9a-f-]+$/);
      return;
    }
  }
  throw new Error(`order not found: ${name}`);
}

test("未受取: 「受取時間を過ぎました」。支払い済みは残し、スワイプは出さない。キャンセルポリシーへ", async ({ page }) => {
  await demoLogin(page);
  await openOrder(page, /受取時間を過ぎたデモBOX/, ["ready", "unclaimed"]);
  await expect(page.getByRole("heading", { name: "受取時間を過ぎました" })).toBeVisible();
  await expect(page.getByTestId("pickup-missed")).toContainText("この注文は受取時間を過ぎています。");
  await expect(page.getByTestId("pickup-missed").getByRole("link", { name: "キャンセルポリシー" })).toBeVisible();
  await expect(page.getByTestId("ticket-paid")).toHaveText("支払い済み");
  await expect(page.getByTestId("pickup-status")).toHaveText("未受取");
  await expect(page.getByTestId("pickup-swipe-knob")).toHaveCount(0);
});

test("返金済み: 「返金済み」。受取チケットとして操作できない（スワイプなし）", async ({ page }) => {
  await demoLogin(page);
  await openOrder(page, /返金済みのデモBOX/, ["refunded"]);
  await expect(page.getByRole("heading", { name: "返金済み" })).toBeVisible();
  await expect(page.getByTestId("pickup-ticket")).toHaveCount(0);
  await expect(page.getByTestId("ticket-paid")).toHaveCount(0);
  await expect(page.getByTestId("pickup-swipe-knob")).toHaveCount(0);
});

for (const width of [375, 390, 430]) {
  test(`幅 ${width}px: チケットが崩れず、横スクロールが出ない`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await demoLogin(page);
    await openOrder(page, /受取時間を過ぎたデモBOX/, ["ready", "unclaimed"]);
    await expect(page.getByTestId("pickup-ticket")).toBeVisible();
    await expect(page.getByTestId("ticket-order-number")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    await expect(page.getByRole("navigation", { name: "メインメニュー" })).toBeHidden();
  });
}
