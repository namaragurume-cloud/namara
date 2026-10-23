import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3200);
const V2_PORT = Number(process.env.E2E_V2_PORT || 3201);
// 起動済みのサーバー（例: next start + DATABASE_URL）に対して実行する場合は E2E_BASE_URL を指定（旧導線のテストのみ）
const EXTERNAL = process.env.E2E_BASE_URL;

const serverEnv = (port: number) => ({
  PGLITE_DATA_DIR: "memory",
  ENABLE_DEMO_LOGIN: "true",
  NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
  DATABASE_URL: "",
  NEXT_PUBLIC_LIFF_ID: "",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
});

/**
 * E2E: 組み込み DB（PGlite・メモリ）でアプリを起動し、デモログインで確認する。Stripe には通信しない。
 *   - mobile    : 機能フラグ OFF（旧導線: 予約 → 店頭 QR）。e2e/*.spec.ts
 *   - v2-375    : 機能フラグ ON（ENABLE_V2_CHECKOUT=true）・幅 375px。e2e/v2/*.spec.ts
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      testIgnore: /v2\//,
      use: { ...devices["Pixel 7"], browserName: "chromium", baseURL: EXTERNAL || `http://localhost:${PORT}` },
    },
    {
      name: "v2-375",
      testMatch: /v2\/.*\.spec\.ts/,
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        viewport: { width: 375, height: 740 },
        baseURL: `http://localhost:${V2_PORT}`,
      },
    },
  ],
  webServer: EXTERNAL
    ? undefined
    : [
        {
          command: `npx next dev -p ${PORT}`,
          url: `http://localhost:${PORT}/login`,
          timeout: 180_000,
          reuseExistingServer: false,
          env: { ...serverEnv(PORT), ENABLE_V2_CHECKOUT: "false" },
        },
        {
          command: `npx next dev -p ${V2_PORT}`,
          url: `http://localhost:${V2_PORT}/login`,
          timeout: 180_000,
          reuseExistingServer: false,
          env: { ...serverEnv(V2_PORT), ENABLE_V2_CHECKOUT: "true", NEXT_DIST_DIR: ".next/e2e-v2" },
        },
      ],
});
