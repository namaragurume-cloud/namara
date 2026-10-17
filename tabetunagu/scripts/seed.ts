/**
 * デモデータを投入する（架空の札幌の店舗・ユーザー・過去40日の履歴・今日の出品）。
 *   npm run db:seed                 # 空のDBに投入。既にデータがあれば今日のデモ出品だけ作り直す
 *   npm run db:seed -- --refresh    # 今日のデモ出品を作り直す
 * 本番（APP_ENV=production / VERCEL_ENV=production）では実行できません。
 */
import path from "node:path";
import { runMigrations } from "../src/server/db/migrate";
import { createPgliteDriver } from "../src/server/db/pglite";
import { createPostgresDriver } from "../src/server/db/postgres";
import { refreshDemoListings, seedIfEmpty } from "../src/server/db/seed";

async function main() {
  if (process.env.APP_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to seed demo data in production.");
  }
  const url = process.env.DATABASE_URL;
  const driver = url
    ? createPostgresDriver(url)
    : await createPgliteDriver(process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".data/pglite"));
  try {
    if (!url) await runMigrations(driver, { bootstrap: true });
    const result = await driver.transaction(async (q) => {
      if (process.argv.includes("--refresh")) {
        await refreshDemoListings(q);
        return "refreshed";
      }
      return seedIfEmpty(q);
    });
    console.log(`Seed: ${result}`);
  } finally {
    await driver.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
