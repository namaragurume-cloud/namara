import { expect, test, type Page } from "@playwright/test";

/** 管理ダッシュボード（PoC 運営の判断用）。PC（1280px）優先、スマホでも重大項目が崩れないこと */
async function demoLogin(page: Page, account: "user" | "storeOwner" | "admin") {
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

test("PC: PoC ステータス → 要対応 → KPI（目標・母数・評価）→ 売上 → 店舗 → STANDARD 候補 → 技術状態の順", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await demoLogin(page, "admin");
  await page.goto("/admin");
  const dash = page.getByTestId("admin-dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "PoC ダッシュボード" })).toBeVisible();
  await expect(page.getByTestId("poc-status")).toContainText(/運用中|公開準備中|要対応/);
  await expect(page.getByTestId("admin-alerts")).toContainText("要対応");
  // 要対応: 0件なら案内、あれば重要度の文字ラベルつき
  const alerts = page.getByTestId("admin-alerts").locator("[data-testid^='alert-']");
  if ((await alerts.count()) === 0) await expect(page.getByTestId("alerts-empty")).toContainText("現在、重大な要対応項目はありません。");
  else await expect(alerts.first()).toContainText(/対応必要|注意/);

  // 情報の順番（技術情報は上にしない）
  const order = await dash.locator(":scope > [data-testid]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  const idx = (id: string) => order.indexOf(id);
  expect(idx("admin-status")).toBe(0);
  for (const [a, b] of [
    ["admin-status", "admin-poc-kpis"],
    ["admin-poc-kpis", "admin-v2-kpis"],
    ["admin-v2-kpis", "admin-stores"],
    ["admin-stores", "admin-users"],
    ["admin-users", "admin-standard"],
  ]) {
    expect(idx(a)).toBeLessThan(idx(b));
  }

  // KPI: 5つ。値・母数・目標・評価（データ不足を含む）
  for (const key of ["tsunagiRate", "repeatRate", "storeWau", "swipeRate", "standardCandidates"]) {
    const card = page.getByTestId(`kpi-${key}`);
    await expect(card).toBeVisible();
    await expect(card.getByTestId("kpi-state")).toHaveText(/達成|あと少し|未達|データ不足/);
    await expect(card).toContainText("目標");
  }
  await expect(page.getByTestId("kpi-tsunagiRate").getByTestId("kpi-sample")).toHaveText(/^[\d,]+ \/ [\d,]+件$/);
  await expect(page.getByTestId("kpi-tsunagiRate")).toContainText("80%以上");
  await expect(page.getByTestId("kpi-swipeRate")).toContainText("95%以上");
  await expect(page.getByTestId("kpi-repeatRate")).toContainText("40%以上");
  await expect(page.getByTestId("kpi-storeWau")).toContainText("70%以上");
  // デモはリピートの対象が少ないため「データ不足」
  await expect(page.getByTestId("kpi-repeatRate").getByTestId("kpi-state")).toHaveText("データ不足");

  // 売上: 実売上 = 手数料 + チャージ（月額の想定売上は含めない）
  await expect(page.getByTestId("metric-gmv")).toContainText("円");
  await expect(page.getByTestId("metric-platform-revenue")).toContainText("手数料");
  await expect(page.getByTestId("admin-v2-kpis")).toContainText("課金（Billing）が未実装のため、実売上に含めていません");

  // 店舗・公開準備（件数 → 店舗一覧）
  for (const k of ["未設定", "商品準備中", "Stripe設定待ち", "公開準備OK"]) {
    await expect(page.getByTestId(`readiness-${k}`)).toHaveText(new RegExp(`${k}\\s*\\d+店舗`));
  }
  await expect(page.getByTestId("metric-listed-today")).toBeVisible();

  // STANDARD 候補（損益分岐の金額を表示。断定しない）
  const standard = page.getByTestId("admin-standard");
  await expect(standard).toContainText("41,500円");
  await expect(standard).toContainText("必ずお得になるとは限りません");

  // 技術状態: 秘密の値は出さない。設定済み / 未設定だけ
  const tech = page.getByTestId("launch-readiness");
  await expect(tech).toContainText("PoC 公開準備");
  await expect(page.getByTestId("flag-status")).toContainText("ON");
  await expect(page.getByTestId("cron-status")).toContainText(/最終成功|更新されていません|一度も成功していません/);
  await expect(tech).toContainText(/設定済み|未設定/);
  await expect(page.locator("main")).not.toContainText(/sk_test_|sk_live_|whsec_|pi_|acct_1/);

  // 判定は参考表示。「Go」と断定しない
  await expect(page.getByTestId("go-no-go-verdict")).toContainText("公開準備未完了");
  await expect(page.getByTestId("admin-go-no-go")).toContainText(/\d \/ 5 達成/);
});

test("期間の切り替え（今日・7日・30日・PoC累計）", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await demoLogin(page, "admin");
  await page.goto("/admin");
  const tabs = page.getByTestId("dashboard-period");
  await expect(tabs.getByRole("link", { name: "30日" })).toHaveAttribute("aria-current", "page");
  for (const name of ["今日", "7日", "PoC累計"]) {
    await tabs.getByRole("link", { name }).click();
    await expect(tabs.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(`期間: ${name}`).first()).toBeVisible();
    await expect(page.getByTestId("kpi-tsunagiRate")).toBeVisible();
  }
});

test("要確認の決済 → review 画面 / 未受取 → unclaimed 画面 / CSV / 店舗一覧", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await demoLogin(page, "admin");
  await page.goto("/admin");
  await page.getByTestId("risk-review").click();
  await expect(page.getByRole("heading", { name: "要確認の決済" })).toBeVisible();
  await page.goto("/admin");
  await page.getByTestId("risk-unclaimed").click();
  await expect(page.getByRole("heading", { name: /未受取/ })).toBeVisible();
  await page.goto("/admin?period=7d");
  const href = await page.getByTestId("csv-orders").getAttribute("href");
  expect(href).toBe("/admin/export?type=orders&period=7d");
  const csv = await page.request.get(href!);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const body = await csv.text();
  expect(body).toContain("order_number");
  expect(body).not.toMatch(/user_id|display_name|line_user_id|ip_address/);
  await page.getByTestId("readiness-公開準備OK").click();
  await expect(page.getByTestId("store-launch-status").first()).toBeVisible();
});

test("スマホでも PoC ステータス・要対応・主要 KPI が崩れない", async ({ page }) => {
  await demoLogin(page, "admin");
  await page.goto("/admin");
  for (const id of ["poc-status", "admin-alerts", "kpi-tsunagiRate", "kpi-swipeRate"]) {
    const box = (await page.getByTestId(id).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("管理者以外（一般ユーザー・店舗オーナー）はダッシュボード・CSV にアクセスできない", async ({ page }) => {
  for (const account of ["user", "storeOwner"] as const) {
    await demoLogin(page, account);
    expect((await page.goto("/admin"))?.status()).toBe(404);
    expect((await page.request.get("/admin/export?type=orders&period=30d")).status()).toBe(404);
    await page.context().clearCookies();
  }
});

test("LINE 通知デモ: 有効にしていない環境では管理者にも出さない（一般ユーザーは常に不可）", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await demoLogin(page, "admin");
  expect((await page.goto("/admin/line-demo"))?.status()).toBe(404);
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "LINE通知デモ" })).toHaveCount(0);
  await page.context().clearCookies();
  await demoLogin(page, "user");
  expect((await page.goto("/admin/line-demo"))?.status()).toBe(404);
});
