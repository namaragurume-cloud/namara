import { expect, test, type Page } from "@playwright/test";

/** マイページ・注文履歴・ポイント履歴（375px）。デモのユーザーは 受取待ち・受取時間を過ぎた・返金済み・お支払い待ち の注文を持つ */
async function demoLogin(page: Page, account: "user" | "storeStaff") {
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("マイページ: 今日の受取が最上部 → 受取チケット。受取待ち件数・ポイント・過去の食べつなぎ・注文履歴・お気に入り", async ({ page }) => {
  await demoLogin(page, "user");
  await page.goto("/me");
  // 最初の画面に 受取 → 件数/ポイント が入る
  const next = page.getByTestId("my-next-pickup");
  await expect(next).toBeVisible();
  await expect(page.getByTestId("my-pickups").getByRole("heading", { level: 2 })).toHaveText(/今日の受取|受取待ち/);
  await expect(next).toContainText("受取チケットのデモBOX");
  await expect(next).toContainText(/\d{2}:\d{2}〜\d{2}:\d{2}/);
  await expect(next).toContainText("大通ベーカリー");
  const nextBox = (await next.boundingBox())!;
  expect(nextBox.y).toBeLessThan(200);
  const points = page.getByTestId("my-points");
  await expect(points).toHaveText(/^[\d,]+pt$/);
  expect((await points.boundingBox())!.y + 40).toBeLessThan(740 * 2);
  await expect(page.getByTestId("my-ready-count")).toHaveText(/^[1-9]\d*件$/);
  await expect(page.getByTestId("my-picked-up-count")).toHaveText(/^\d+回$/);
  await expect(page.getByRole("heading", { name: "注文履歴" })).toBeVisible();
  await expect(page.getByTestId("my-favorites")).toContainText("大通ベーカリー");
  // 根拠のない推計値（削減量など）は出さない
  await expect(page.getByTestId("my-page")).not.toContainText(/kg|削減|CO2/);
  // 規約・ログアウトは下部
  for (const name of ["利用規約", "プライバシーポリシー", "特定商取引法に基づく表記", "キャンセルポリシー"]) {
    await expect(page.getByTestId("my-page").getByRole("link", { name })).toBeVisible();
  }
  await expect(page.getByTestId("my-page").getByRole("button", { name: "ログアウト" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  // 現在地タブ
  const nav = page.getByRole("navigation", { name: "メインメニュー" });
  await expect(nav.getByRole("link", { name: "マイページ" })).toHaveAttribute("aria-current", "page");
  for (const name of ["ホーム", "探す", "注文", "お気に入り"]) await expect(nav.getByRole("link", { name })).toBeVisible();

  await next.getByRole("link", { name: "受取チケットを見る" }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]+$/);
  await expect(page.getByTestId("pickup-ticket")).toBeVisible();
});

test("注文履歴: 状態ラベルと状態ごとの CTA。絞り込み（すべて・受取待ち・完了・その他）", async ({ page }) => {
  await demoLogin(page, "user");
  await page.goto("/orders");
  const nav = page.getByRole("navigation", { name: "メインメニュー" });
  await expect(nav.getByRole("link", { name: "注文" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("tab", { name: "すべて" })).toHaveAttribute("aria-selected", "true");
  for (const name of ["受取待ち", "完了", "その他"]) await expect(page.getByRole("tab", { name })).toBeVisible();
  await expectNoHorizontalScroll(page);

  const card = (name: string) => page.getByTestId("order-card").filter({ hasText: name });
  // 受取待ち → 受取チケットを見る
  await expect(card("受取チケットのデモBOX").getByTestId("order-status")).toHaveText("受取待ち");
  await expect(card("受取チケットのデモBOX").getByTestId("order-cta")).toHaveText("受取チケットを見る");
  // 受取時間を過ぎた → 未受取（責めない表現）
  const missed = card("受取時間を過ぎたデモBOX");
  await expect(missed.getByTestId("order-status")).toHaveText("未受取");
  await expect(missed.getByTestId("order-note")).toContainText("受取時間を過ぎました");
  await expect(missed.getByTestId("order-note")).toContainText("この注文は受取時間内に受取完了されませんでした。");
  await expect(missed.getByTestId("order-cta")).toHaveText("注文詳細を見る");
  // 返金済み → 返金額・返金日時
  const refunded = card("返金済みのデモBOX");
  await expect(refunded.getByTestId("order-status")).toHaveText("返金済み");
  await expect(refunded.getByTestId("order-note")).toContainText(/返金額 [\d,]+円・/);
  await expect(refunded.getByTestId("order-cta")).toHaveText("返金内容を見る");
  // お支払い待ち → 決済を続ける
  const pending = card("お支払い待ちのデモBOX");
  await expect(pending.getByTestId("order-status")).toHaveText("お支払い待ち");
  await expect(pending.getByTestId("order-cta")).toHaveText("決済を続ける");
  // 内部の status 名・決済の ID は出さない
  await expect(page.getByTestId("order-list")).not.toContainText(/pending_payment|picked_up|unclaimed|refunded|cancelled|pi_|cs_/);

  // 絞り込み
  await page.getByRole("tab", { name: "受取待ち" }).click();
  await expect(page.getByRole("tab", { name: "受取待ち" })).toHaveAttribute("aria-selected", "true");
  await expect(card("返金済みのデモBOX")).toHaveCount(0);
  await expect(card("受取チケットのデモBOX")).toBeVisible();
  await page.getByRole("tab", { name: "その他" }).click();
  await expect(card("返金済みのデモBOX")).toBeVisible();
  await expect(card("お支払い待ちのデモBOX")).toBeVisible();
  await expect(card("受取チケットのデモBOX")).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test("注文履歴 → 返金内容（返金額・返金日時）/ お支払い待ち → 決済を続ける / 未受取の詳細", async ({ page }) => {
  await demoLogin(page, "user");
  await page.goto("/orders?tab=other");
  await page.getByTestId("order-card").filter({ hasText: "返金済みのデモBOX" }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "返金済み" })).toBeVisible();
  await expect(page.getByTestId("refund-detail")).toContainText(/返金額\s*[\d,]+円/);
  await expect(page.getByTestId("refund-detail")).toContainText("返金日時");
  await expect(page.locator("main")).not.toContainText(/re_|pi_|requires_|succeeded/);

  await page.goto("/orders?tab=other");
  await page.getByTestId("order-card").filter({ hasText: "お支払い待ちのデモBOX" }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "お支払い待ち" })).toBeVisible();
  await expect(page.getByRole("button", { name: /お支払い|決済/ }).first()).toBeVisible();

  await page.goto("/orders");
  await page.getByTestId("order-card").filter({ hasText: "受取時間を過ぎたデモBOX" }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "受取時間を過ぎました" })).toBeVisible();
});

test("ポイント履歴: 残高（台帳）と 獲得 / 取消 の履歴", async ({ page }) => {
  await demoLogin(page, "user");
  await page.goto("/me");
  const shown = await page.getByTestId("my-points").textContent();
  await page.getByRole("link", { name: "ポイント履歴" }).click();
  await page.waitForURL(/\/me\/points$/);
  await expect(page.getByTestId("points-balance")).toHaveText(shown!);
  await expect(page.getByText("決済完了後にポイントが付与されます。")).toBeVisible();
  const entries = page.getByTestId("points-entry");
  await expect(page.getByTestId("points-history").locator('[data-type="earned"]').first()).toContainText(/獲得.*\+\d+pt/s);
  // 返金済みのデモ注文のポイントは取消
  await expect(page.getByTestId("points-history").locator('[data-type="revoked"]').first()).toContainText(/取消.*-\d+pt/s);
  expect(await entries.count()).toBeGreaterThan(1);
  await expect(page.locator("main")).not.toContainText(/order_paid|order_refunded|balance_migration|checkin/);
  await expect(page.getByRole("navigation", { name: "メインメニュー" }).getByRole("link", { name: "マイページ" })).toHaveAttribute("aria-current", "page");
  await expectNoHorizontalScroll(page);
});

test("空状態: 注文・ポイント・お気に入りがないとき（エラー風にしない）", async ({ page }) => {
  await demoLogin(page, "storeStaff");
  await page.goto("/me");
  await expect(page.getByTestId("my-pickups")).toHaveCount(0);
  await expect(page.getByTestId("my-orders-empty")).toContainText("まだ食べつないだ商品はありません。");
  await expect(page.getByTestId("my-orders-empty").getByRole("link", { name: "商品を探す" })).toBeVisible();
  await expect(page.getByTestId("my-points-card")).toContainText("まだポイントはありません。");
  await expect(page.getByTestId("my-favorites-empty")).toContainText("お気に入りに追加しておくと、あとで見つけやすくなります。");
  await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  await page.goto("/orders");
  await expect(page.getByText("まだ食べつないだ商品はありません。")).toBeVisible();
  await expect(page.getByRole("link", { name: "商品を探す" })).toBeVisible();
  await page.goto("/me/points");
  await expect(page.getByTestId("points-empty")).toContainText("まだポイントはありません。");
});
