/**
 * マイグレーションを適用する。
 *   DATABASE_URL=postgres://... npm run db:migrate          # Supabase / PostgreSQL
 *   npm run db:migrate                                       # ローカル PGlite（.data/pglite）
 *   npm run db:migrate -- --bootstrap                        # 素の PostgreSQL（Supabase 以外）にロールと auth スキーマも作る
 */
import path from "node:path";
import { runMigrations } from "../src/server/db/migrate";
import { createPgliteDriver } from "../src/server/db/pglite";
import { createPostgresDriver } from "../src/server/db/postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  const driver = url
    ? createPostgresDriver(url)
    : await createPgliteDriver(process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".data/pglite"));
  const bootstrap = !url || process.argv.includes("--bootstrap");
  try {
    const applied = await runMigrations(driver, { bootstrap });
    console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Already up to date.");
  } finally {
    await driver.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
