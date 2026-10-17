import { expect, test, type Page } from "@playwright/test";

async function demoLogin(page: Page, account: "user" | "storeOwner" | "storeStaff" | "admin") {
  await page.goto("/login");
  await page.locator(`form:has(input[value="${account}"]) button`).click();
  await page.waitForLoadState("networkidle");
}

test("出品 → 発見 → 予約 → 店舗QR → 食べつなぎ完了", async ({ browser }) => {
  // 店舗オーナー: 出品して QR の URL を取得
  const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const owner = await ownerCtx.newPage();
  await demoLogin(owner, "storeOwner");
  await owner.goto("/store/products/new");
  await owner.getByLabel("商品名").fill("E2Eテスト食べつなぎBOX");
  await owner.getByLabel("通常価格（相当）").fill("1600");
  await owner.getByLabel("食べつなぎ価格").fill("900");
  await owner.getByLabel("数量").fill("1");
  await owner.getByLabel("受取開始").fill("00:00");
  await owner.getByLabel("受取終了").fill("23:45");
  await owner.getByRole("button", { name: "確認して公開する" }).click();
  await owner.waitForURL(/\/store\?published=/);
  await expect(owner.getByText("出品しました")).toBeVisible();
  await owner.goto("/store/qr");
  const qrPath = new URL(await owner.getByTestId("store-qr-url").innerText()).pathname;

  // ユーザー: 一覧 → 詳細 → 予約
  const page = await browser.newPage();
  await page.goto("/stores/odori-bakery");
  await page.getByRole("link", { name: /E2Eテスト食べつなぎBOX/ }).click();
  await expect(page.getByText("食べつなぎ価格").first()).toBeVisible();
  await page.getByRole("link", { name: "食べつなぐ" }).click();
  await page.waitForURL(/\/login/);
  await page.locator('form:has(input[value="user"]) button').click();
  await page.waitForURL(/\/reserve$/);
  await page.getByRole("button", { name: "予約を確定する" }).click();
  await page.waitForURL(/\/reservations\/.+\?new=1/);
  await expect(page.getByRole("heading", { name: "予約が完了しました" })).toBeVisible();
  await expect(page.getByText("店舗に着いたらQRを読み取ってください")).toBeVisible();

  // 店頭QR → 受け取りを確定 → 完了
  await page.goto(qrPath);
  await expect(page.getByText("E2Eテスト食べつなぎBOX")).toBeVisible();
  await page.getByRole("button", { name: "受け取りを確定する" }).click();
  await page.waitForURL(/\/done\//);
  await expect(page.getByRole("heading", { name: "食べつなぎ完了！" })).toBeVisible();
  await expect(page.getByText("+10")).toBeVisible();

  // 同じQRをもう一度: 有効な予約はない（二重完了しない）
  await page.goto(qrPath);
  await expect(page.getByText("この店舗での有効な予約はありません")).toBeVisible();

  // 店舗側: 完了が反映される
  await owner.goto("/store/reservations");
  await expect(owner.getByText("食べつなぎ完了").first()).toBeVisible();
  await ownerCtx.close();
});

test("一般ユーザーは店舗・管理画面にアクセスできない", async ({ page }) => {
  await demoLogin(page, "user");
  for (const path of ["/admin", "/store", "/admin/stores"]) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
  }
});

test("店舗スタッフは管理画面にアクセスできない", async ({ page }) => {
  await demoLogin(page, "storeStaff");
  expect((await page.goto("/admin"))?.status()).toBe(404);
  expect((await page.goto("/store"))?.status()).toBe(200);
  await expect(page.getByText("すすきのデリ").first()).toBeVisible();
});

test("改ざんされたQRは受け付けない", async ({ page }) => {
  await demoLogin(page, "user");
  await page.goto("/c/v1.00000000000040008000000000000000.1.AAAAAAAAAAAAAAAAAAAAAAAA");
  await expect(page.getByRole("heading", { name: "QRコードを確認できませんでした" })).toBeVisible();
});
