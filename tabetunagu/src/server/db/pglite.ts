import { mkdir } from "node:fs/promises";
import { PGlite, type PGliteInterface } from "@electric-sql/pglite";
import type { Driver, Queryable } from "./types";

/** ローカル開発・テスト用の組み込み PostgreSQL（WASM）。DATABASE_URL 未設定時に使う。 */
export async function createPgliteDriver(dataDir?: string): Promise<Driver & { pglite: PGliteInterface }> {
  if (dataDir) await mkdir(dataDir, { recursive: true });
  return wrapPglite(await PGlite.create(dataDir));
}

export function wrapPglite(db: PGliteInterface): Driver & { pglite: PGliteInterface } {
  return {
    kind: "pglite",
    pglite: db,
    async transaction(fn) {
      return db.transaction(async (tx) => {
        const q: Queryable = {
          async query<T>(text: string, params?: unknown[]) {
            const res = await tx.query<T>(text, params);
            return res.rows;
          },
        };
        return fn(q);
      });
    },
    async exec(sql) {
      await db.transaction(async (tx) => {
        await tx.exec(sql);
      });
    },
    async close() {
      await db.close();
    },
  };
}
