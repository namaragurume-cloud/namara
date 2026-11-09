import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { demoSeed } from "./demo";
import { isDemo } from "./demo-flag";
import type { CollectionName, Collections } from "./types";

/**
 * 業務ツールのデータ保存先。
 *
 *  - Upstash Redis（Vercel の Marketplace から追加）：本番用
 *      UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *      （Vercel の KV 連携で入る KV_REST_API_URL / KV_REST_API_TOKEN でも可）
 *  - ローカルファイル（.data/ops.json）：開発用。本番では使用しません
 *
 * 1件ずつ別のキーに保存するため、複数の発信者が同時に回答しても互いの回答を上書きしません。
 */

const PREFIX = "ops:";

type Backend = {
  blobSet(key: string, base64: string, ttlSec: number): Promise<void>;
  blobGet(key: string): Promise<string | null>;
  blobDel(key: string): Promise<void>;
  all(collection: CollectionName): Promise<Record<string, string>>;
  get(collection: CollectionName, id: string): Promise<string | null>;
  set(collection: CollectionName, id: string, value: string): Promise<void>;
  del(collection: CollectionName, id: string): Promise<void>;
};

export class DbNotConfiguredError extends Error {}

function redisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function dbMode(): "redis" | "file" | "demo" | null {
  if (isDemo()) return "demo";
  if (redisConfig()) return "redis";
  if (process.env.NODE_ENV !== "production" || process.env.OPS_FILE_DB === "true") return "file";
  return null;
}

function redisBackend(cfg: { url: string; token: string }): Backend {
  async function cmd<T>(args: (string | number)[]): Promise<T> {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as { result?: T; error?: string } | null;
    if (!res.ok || !body || body.error) {
      throw new Error(`Redis error ${res.status}: ${body?.error ?? "unknown"}`);
    }
    return body.result as T;
  }
  return {
    async blobSet(k, v, ttl) {
      await cmd(ttl > 0 ? ["SET", `${PREFIX}blob:${k}`, v, "EX", ttl] : ["SET", `${PREFIX}blob:${k}`, v]);
    },
    blobGet: (k) => cmd<string | null>(["GET", `${PREFIX}blob:${k}`]),
    async blobDel(k) {
      await cmd(["DEL", `${PREFIX}blob:${k}`]);
    },
    async all(c) {
      const flat = await cmd<string[]>(["HGETALL", PREFIX + c]);
      const out: Record<string, string> = {};
      for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
      return out;
    },
    get: (c, id) => cmd<string | null>(["HGET", PREFIX + c, id]),
    async set(c, id, v) {
      await cmd(["HSET", PREFIX + c, id, v]);
    },
    async del(c, id) {
      await cmd(["HDEL", PREFIX + c, id]);
    },
  };
}

function fileBackend(): Backend {
  const file = path.join(process.cwd(), ".data", "ops.json");
  let queue: Promise<unknown> = Promise.resolve();
  type Data = Partial<Record<CollectionName, Record<string, string>>>;

  async function read(): Promise<Data> {
    try {
      return JSON.parse(await fs.readFile(file, "utf8")) as Data;
    } catch {
      return {};
    }
  }
  function write(mutate: (d: Data) => void): Promise<void> {
    const run = queue.then(async () => {
      const d = await read();
      mutate(d);
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(d, null, 1));
      await fs.rename(tmp, file);
    });
    queue = run.catch(() => {});
    return run;
  }
  const blobFile = (k: string) => path.join(process.cwd(), ".data", "blobs", k.replace(/[^\w-]/g, "_"));
  return {
    async blobSet(k, v) {
      await fs.mkdir(path.dirname(blobFile(k)), { recursive: true });
      await fs.writeFile(blobFile(k), v);
    },
    blobGet: (k) => fs.readFile(blobFile(k), "utf8").catch(() => null),
    async blobDel(k) {
      await fs.rm(blobFile(k), { force: true });
    },
    all: async (c) => (await read())[c] ?? {},
    get: async (c, id) => (await read())[c]?.[id] ?? null,
    set: (c, id, v) =>
      write((d) => {
        (d[c] ??= {})[id] = v;
      }),
    del: (c, id) =>
      write((d) => {
        delete d[c]?.[id];
      }),
  };
}

/** デモ用：サンプルデータを入れたメモリ上の保存先（サーバーの再起動で元に戻る） */
// ページとAPIで別々に読み込まれても同じデータを見るよう、globalThis に置く
type DemoData = { rows: Map<CollectionName, Map<string, string>>; blobs: Map<string, string> };
const g = globalThis as typeof globalThis & { __opsDemo?: DemoData };
export function resetDemo() {
  const seed = demoSeed();
  g.__opsDemo = {
    rows: new Map(Object.entries(seed).map(([k, list]) => [k as CollectionName, new Map(list.map((x) => [x.id, JSON.stringify(x)]))])),
    blobs: new Map(),
  };
}
function demoBackend(): Backend {
  const data = () => {
    if (!g.__opsDemo) resetDemo();
    return g.__opsDemo!;
  };
  const col = (c: CollectionName) => {
    const rows = data().rows;
    if (!rows.has(c)) rows.set(c, new Map());
    return rows.get(c)!;
  };
  return {
    async blobSet(k, v) {
      data().blobs.set(k, v);
    },
    blobGet: async (k) => data().blobs.get(k) ?? null,
    async blobDel(k) {
      data().blobs.delete(k);
    },
    all: async (c) => Object.fromEntries(col(c)),
    get: async (c, id) => col(c).get(id) ?? null,
    async set(c, id, v) {
      col(c).set(id, v);
    },
    async del(c, id) {
      col(c).delete(id);
    },
  };
}

let cached: Backend | null = null;
function backend(): Backend {
  if (cached) return cached;
  const mode = dbMode();
  const cfg = redisConfig();
  if (mode === "demo") cached = demoBackend();
  else if (mode === "redis" && cfg) cached = redisBackend(cfg);
  else if (mode === "file") cached = fileBackend();
  else throw new DbNotConfiguredError("Database is not configured");
  return cached;
}

/** スクショ画像の保存期間（日）。これを過ぎると画像は自動で消えます（読み取った数値は残ります） */
const BLOB_TTL_DAYS = 180;

export const blobs = {
  set: (key: string, base64: string) => backend().blobSet(key, base64, BLOB_TTL_DAYS * 86_400),
  /** 期限なしで保存（発信者のアイコンなど） */
  setForever: (key: string, base64: string) => backend().blobSet(key, base64, 0),
  get: (key: string) => backend().blobGet(key),
  del: (key: string) => backend().blobDel(key),
};

export const db = {
  async list<C extends CollectionName>(c: C): Promise<Collections[C][]> {
    const raw = await backend().all(c);
    return Object.values(raw).map((v) => JSON.parse(v) as Collections[C]);
  },
  async get<C extends CollectionName>(c: C, id: string): Promise<Collections[C] | null> {
    if (!id) return null;
    const v = await backend().get(c, id);
    return v ? (JSON.parse(v) as Collections[C]) : null;
  },
  async put<C extends CollectionName>(c: C, value: Collections[C] & { id: string }): Promise<void> {
    await backend().set(c, value.id, JSON.stringify(value));
  },
  async update<C extends CollectionName>(
    c: C,
    id: string,
    patch: (current: Collections[C]) => Collections[C],
  ): Promise<Collections[C] | null> {
    const current = await db.get(c, id);
    if (!current) return null;
    const next = patch(current);
    await db.put(c, next as Collections[C] & { id: string });
    return next;
  },
  async remove(c: CollectionName, id: string): Promise<void> {
    await backend().del(c, id);
  },
};
