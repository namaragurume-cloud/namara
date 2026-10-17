import "server-only";
import path from "node:path";
import { AppError } from "@/lib/errors";
import { env } from "../env";
import type { DbActor, Driver, Queryable } from "./types";

export type { DbActor, Queryable, Row } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DriverHolder = { promise?: Promise<Driver> };
const holder: DriverHolder = ((globalThis as { __tabetunaguDb?: DriverHolder }).__tabetunaguDb ??= {});

async function createDriver(): Promise<Driver> {
  if (env.databaseUrl) {
    const { createPostgresDriver } = await import("./postgres");
    return createPostgresDriver(env.databaseUrl);
  }
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is required on Vercel");
  }
  // ローカル: 組み込み PostgreSQL（PGlite）。初回にマイグレーションとデモデータを投入する。
  const { createPgliteDriver } = await import("./pglite");
  const { runMigrations } = await import("./migrate");
  const dir = process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".data/pglite");
  const driver = await createPgliteDriver(dir === "memory" ? undefined : dir);
  await runMigrations(driver, { bootstrap: true });
  const { seedIfEmpty } = await import("./seed");
  await driver.transaction((q) => seedIfEmpty(q));
  return driver;
}

export function getDriver(): Promise<Driver> {
  holder.promise ??= createDriver().catch((error) => {
    holder.promise = undefined;
    throw error;
  });
  return holder.promise;
}

/** テスト用: ドライバを差し替える */
export function setDriverForTesting(driver: Driver | undefined) {
  holder.promise = driver ? Promise.resolve(driver) : undefined;
}

/**
 * actor の権限でトランザクションを実行する。
 * anon / user のときは Supabase と同じく role と request.jwt.claims を設定し、RLS を効かせる。
 */
export async function withDb<T>(actor: DbActor, fn: (q: Queryable) => Promise<T>): Promise<T> {
  const driver = await getDriver();
  try {
    return await driver.transaction(async (q) => {
      if (actor.kind === "user") {
        if (!UUID_RE.test(actor.userId)) throw new AppError("not_authenticated");
        await q.query("select set_config('role', 'authenticated', true), set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: actor.userId, role: "authenticated" }),
        ]);
      } else if (actor.kind === "anon") {
        await q.query("select set_config('role', 'anon', true), set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ role: "anon" }),
        ]);
      }
      return fn(q);
    });
  } catch (error) {
    throw AppError.from(error);
  }
}

export const asService = <T>(fn: (q: Queryable) => Promise<T>) => withDb({ kind: "service" }, fn);
export const asAnon = <T>(fn: (q: Queryable) => Promise<T>) => withDb({ kind: "anon" }, fn);
export const asUser = <T>(userId: string, fn: (q: Queryable) => Promise<T>) => withDb({ kind: "user", userId }, fn);
/** ログイン中ならユーザー権限、未ログインなら anon 権限 */
export const asViewer = <T>(userId: string | null | undefined, fn: (q: Queryable) => Promise<T>) =>
  userId ? asUser(userId, fn) : asAnon(fn);
