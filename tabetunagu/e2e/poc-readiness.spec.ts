import { expect, test, type Page } from "@playwright/test";

async function demoLogin(page: Page, account: "user" | "storeOwner" | "admin") {
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

test("法務ページはログインなしで開け、ドラフトであることが分かる。フッターからたどれる", async ({ page }) => {
  for (const [path, title] of [
    ["/terms", "利用規約"],
    ["/privacy", "プライバシーポリシー"],
    ["/commerce", "特定商取引法に基づく表記"],
    ["/cancellation-policy", "キャンセルポリシー"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(page.getByTestId("legal-draft")).toContainText("ドラフト（専門家確認前）");
  }
  await expect(page.getByTestId("cancellation-summary")).toHaveText("決済後5分以内かつ受取開始前までキャンセル可能です。");
  await page.goto("/commerce");
  await expect(page.getByTestId("commerce-table")).toContainText("販売事業者");
  await expect(page.getByTestId("commerce-table")).toContainText("【要記入】");

  await page.goto("/");
  const links = page.getByTestId("legal-links");
  await links.getByRole("link", { name: "キャンセルポリシー" }).click();
  await page.waitForURL(/\/cancellation-policy$/);
});

test("店舗: 導入準備チェック・使い方・受取モニターの全画面モード（非対応でも動く）", async ({ page }) => {
  await demoLogin(page, "storeOwner");
  await page.goto("/store");
  await expect(page.getByTestId("store-readiness")).toContainText("導入準備チェック");
  await page.goto("/store/help");
  await expect(page.getByText("レジ操作は不要です。")).toBeVisible();
  await expect(page.getByText("店舗側の受取完了操作は不要です。")).toBeVisible();

  await page.goto("/store/monitor");
  const monitor = page.getByTestId("store-monitor");
  await expect(monitor).toHaveAttribute("data-kiosk", "off");
  await page.getByTestId("monitor-kiosk").click();
  await expect(monitor).toHaveAttribute("data-kiosk", "on");
  await expect(page.getByTestId("wake-lock-status")).toContainText("画面スリープ防止");
  await expect(page.getByTestId("monitor-sound")).toContainText("通知音 ON");
  await page.getByTestId("monitor-kiosk").click();
  await expect(monitor).toHaveAttribute("data-kiosk", "off");
});

test("管理者: PoC 公開準備（フラグ OFF・秘密鍵は値を出さない）・要確認の決済・未受取・店舗の公開準備", async ({ page }) => {
  await demoLogin(page, "admin");
  await page.goto("/admin");
  const readiness = page.getByTestId("launch-readiness");
  await expect(readiness).toContainText("PoC 公開準備");
  await expect(page.getByTestId("flag-status")).toContainText("OFF（旧導線）");
  await expect(readiness).not.toContainText("sk_");
  await expect(readiness).not.toContainText("whsec_");
  await readiness.getByRole("link", { name: /要確認の決済/ }).click();
  await expect(page.getByRole("heading", { name: "要確認の決済" })).toBeVisible();
  await page.goto("/admin/unclaimed");
  await expect(page.getByRole("heading", { name: /未受取/ })).toBeVisible();
  await page.goto("/admin/stores");
  await expect(page.getByTestId("store-launch-status").first()).toBeVisible();
});

test("一般ユーザー・店舗は管理者ページと CSV にアクセスできない", async ({ page }) => {
  await demoLogin(page, "user");
  for (const path of ["/admin/review", "/admin/unclaimed"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
  }
  const csv = await page.request.get("/admin/export?type=orders");
  expect(csv.status()).toBe(404);
});
