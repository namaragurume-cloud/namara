import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Driver } from "./types";

function rootDir() {
  return process.env.TABETUNAGU_ROOT || process.cwd();
}

/**
 * supabase/migrations/*.sql をファイル名順に適用する（適用済みは public.schema_migrations に記録）。
 * bootstrap=true のときは Supabase 固有のロール・auth スキーマを先に作る（ローカル専用）。
 */
export async function runMigrations(driver: Driver, opts: { bootstrap: boolean }) {
  const root = rootDir();
  if (opts.bootstrap) {
    await driver.exec(await readFile(path.join(root, "supabase/local/bootstrap.sql"), "utf8"));
  }
  await driver.exec(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
    revoke all on public.schema_migrations from public;
  `);
  const dir = path.join(root, "supabase/migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const done = await driver.transaction((q) =>
      q.query<{ version: string }>("select version from public.schema_migrations where version = $1", [version]),
    );
    if (done.length > 0) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    try {
      await driver.exec(`${sql}\ninsert into public.schema_migrations (version) values ('${version}');`);
    } catch (error) {
      throw new Error(`Migration ${version} failed: ${(error as Error).message}`);
    }
    applied.push(version);
  }
  return applied;
}
