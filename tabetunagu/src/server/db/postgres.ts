import postgres from "postgres";
import type { Driver, Queryable } from "./types";

/**
 * Supabase などの PostgreSQL に接続する。
 * Supabase の Transaction pooler（:6543）でも動くよう prepared statement は使わない。
 */
export function createPostgresDriver(url: string): Driver {
  const sql = postgres(url, {
    prepare: false,
    max: Number(process.env.DATABASE_POOL_MAX || 5),
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return {
    kind: "postgres",
    async transaction<T>(fn: (q: Queryable) => Promise<T>) {
      const result = await sql.begin(async (tx) => {
        const q: Queryable = {
          async query<R>(text: string, params?: unknown[]) {
            // postgres.js の型定義は ParameterOrJSON[] を要求するため unknown[] から変換する
            const rows = await tx.unsafe(text, (params ?? []) as never[]);
            return rows as unknown as R[];
          },
        };
        return fn(q);
      });
      return result as T;
    },
    async exec(text) {
      await sql.begin((tx) => tx.unsafe(text));
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}
