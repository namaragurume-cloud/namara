import { expect, test, type Page } from "@playwright/test";

/**
 * v2 の受取（デジタル受取チケット・自己スワイプ・店舗モニター）。
 * 決済済みの注文はデモデータ（seedDemoOrders）で用意する。Stripe には通信しない。
 */
async function demoLogin(page: Page, account: "user" | "storeOwner") {
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

async function swipe(page: Page) {
  const knob = page.getByTestId("pickup-swipe-knob");
  const track = page.getByTestId("pickup-swipe-track");
  const k = (await knob.boundingBox())!;
  const t = (await track.boundingBox())!;
  await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width - 4, k.y + k.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("決済済みの注文: 受取チケット → スワイプで受取完了 → 店舗モニターに数秒で反映", async ({ browser, page }) => {
  // 店舗: 受取モニターを開いておく
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const owner = await ownerCtx.newPage();
  await demoLogin(owner, "storeOwner");
  await owner.goto("/store/monitor");
  const activeSection = owner.getByTestId("monitor-section-active");
  await expect(activeSection.getByText("受取チケットのデモBOX×1")).toBeVisible();
  await expect(owner.getByRole("button", { name: /完了|受取にする|決済済みにする|QR/ })).toHaveCount(0); // 店舗の操作ボタンはない

  // ユーザー: 注文履歴 → 受取チケット
  await demoLogin(page, "user");
  await page.goto("/orders?tab=ready");
  await page.getByRole("link", { name: /受取チケットのデモBOX/ }).click();
  const ticket = page.getByTestId("pickup-ticket");
  await expect(ticket).toBeVisible();
  await expect(ticket.getByText("支払い済み")).toBeVisible();
  await expect(ticket.getByText("店舗スタッフへこの画面をお見せください。")).toBeVisible();
  await expect(page.getByTestId("pickup-status")).toHaveText("受取待ち");

  // タップだけでは受取完了にならない
  await page.getByTestId("pickup-swipe-knob").click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId("pickup-status")).toHaveText("受取待ち");

  await swipe(page);
  await expect(page.getByTestId("pickup-done")).toBeVisible();
  await expect(page.getByText("この食事が、次の食につながりました。")).toBeVisible();
  await expect(page.getByTestId("pickup-status")).toHaveText("受取完了");
  await expect(page.getByTestId("pickup-swipe-knob")).toHaveCount(0); // 再スワイプ不可

  // 店舗モニター: 再読み込みせずに受取完了へ移る（ポーリング）
  await expect(owner.getByTestId("monitor-section-picked_up").getByText("受取チケットのデモBOX×1")).toBeVisible({ timeout: 8000 });
  await expect(activeSection.getByText("受取チケットのデモBOX×1")).toHaveCount(0);
  await ownerCtx.close();
});

test("受取時間を過ぎた注文は、ユーザー画面で「受取時間を過ぎました」、店舗モニターで「未受取」", async ({ browser, page }) => {
  await demoLogin(page, "user");
  await page.goto("/orders?tab=ready");
  const link = page.getByRole("link", { name: /受取時間を過ぎたデモBOX/ });
  if ((await link.count()) > 0) {
    await link.click();
  } else {
    await page.goto("/orders?tab=unclaimed");
    await page.getByRole("link", { name: /受取時間を過ぎたデモBOX/ }).click();
  }
  await expect(page.getByRole("heading", { name: "受取時間を過ぎました" })).toBeVisible();
  await expect(page.getByTestId("pickup-status")).toHaveText("未受取");
  await expect(page.getByTestId("pickup-swipe-knob")).toHaveCount(0);

  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const owner = await ownerCtx.newPage();
  await demoLogin(owner, "storeOwner");
  await owner.goto("/store/monitor");
  await expect(owner.getByTestId("monitor-section-unclaimed").getByText("受取時間を過ぎたデモBOX×1")).toBeVisible();
  await owner.goto("/store/orders");
  await expect(owner.getByTestId("store-orders").getByText("未受取").first()).toBeVisible();
  await ownerCtx.close();
});
