import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3200);
// 起動済みのサーバー（例: next start + DATABASE_URL）に対して実行する場合は E2E_BASE_URL を指定
const EXTERNAL = process.env.E2E_BASE_URL;

/**
 * E2E: 組み込み DB（PGlite・メモリ）でアプリを起動し、デモログインでコアフローを確認する。
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: EXTERNAL || `http://localhost:${PORT}`,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile", use: { ...devices["Pixel 7"], browserName: "chromium" } }],
  webServer: EXTERNAL
    ? undefined
    : {
        command: `npx next dev -p ${PORT}`,
        url: `http://localhost:${PORT}/login`,
        timeout: 180_000,
        reuseExistingServer: false,
        env: {
          PGLITE_DATA_DIR: "memory",
          ENABLE_DEMO_LOGIN: "true",
          NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
          DATABASE_URL: "",
          NEXT_PUBLIC_LIFF_ID: "",
        },
      },
});
