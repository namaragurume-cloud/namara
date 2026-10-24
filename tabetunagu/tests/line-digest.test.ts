import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DIGEST_MAX_CONSECUTIVE_FAILURES,
  digestCards,
  digestFlexMessage,
  isDigestEligible,
  jstDate,
  jstEndOfDay,
  selectDigestProducts,
  type DigestCandidate,
} from "@/lib/featured-digest";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { getDigestDashboard, runFeaturedDigest, sendDigestTestToSelf, setFeaturedOptIn } from "@/server/services/line-digest";
import { sendEveningDigest } from "@/server/services/notifications";
import { createProduct, createTestDb, IDS } from "./support/db";

const session = vi.hoisted(() => ({ userId: null as string | null, admin: false }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("@/server/auth/viewer", async () => {
  const { AppError } = await import("@/lib/errors");
  return {
    assertAdmin: async () => {
      if (!session.userId || !session.admin) throw new AppError("forbidden");
      return { id: session.userId, isAdmin: true };
    },
    getViewer: async () => (session.userId ? { id: session.userId, isAdmin: session.admin } : null),
  };
});
const { runDigestNowAction, sendDigestTestAction, setLineFeaturedOptInAction } = await import("@/app/actions/line-digest");
const { GET: cronDigestGET } = await import("@/app/api/cron/digest/route");

/** LINE 日次注目商品通知（「今夜の食べつなぎ」・オプトイン）。LINE の API はモック */
const ENV_KEYS = [
  "APP_ENV",
  "LINE_CHANNEL_ACCESS_TOKEN",
  "ENABLE_LINE_DIGEST_SEND",
  "ENABLE_LINE_DIGEST_CRON",
  "ENABLE_LINE_MARKETING_DEMO",
  "NEXT_PUBLIC_LIFF_ID",
  "CRON_SECRET",
] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const k of ENV_KEYS) {
    const v = k in values ? values[k] : saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}
const ACCESS_TOKEN = "digest-channel-access-token-should-not-leak";
const LIVE = { APP_ENV: "preview", LINE_CHANNEL_ACCESS_TOKEN: ACCESS_TOKEN, ENABLE_LINE_DIGEST_SEND: "true", NEXT_PUBLIC_LIFF_ID: "2000000000-AbCdEfGh" };
const LINE_A = `U${"a".repeat(32)}`;
const LINE_B = `U${"b".repeat(32)}`;
const LINE_ADMIN = `U${"d".repeat(32)}`;

// ---------------------------------------------------------------------------
// 商品選定・メッセージ（DB なし）
// ---------------------------------------------------------------------------
const NOW = new Date("2026-10-24T17:00:00+09:00");
let seq = 0;
function cand(over: Partial<DigestCandidate> = {}): DigestCandidate {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    storeId: "store-1",
    name: `商品${seq}`,
    storeName: "店舗1",
    imageUrl: null,
    originalPrice: 1000,
    rescuePrice: 600,
    remaining: 2,
    isBox: false,
    pickupStartAt: "2026-10-24T18:00:00+09:00",
    pickupEndAt: "2026-10-24T21:00:00+09:00",
    ...over,
  };
}

describe("商品選定（AI なし・最大3件・店舗の偏りを抑える）", () => {
  it("JST の日付と当日の終わり", () => {
    expect(jstDate(new Date("2026-10-24T15:30:00Z"))).toBe("2026-10-25");
    expect(jstEndOfDay(NOW).toISOString()).toBe("2026-10-24T15:00:00.000Z");
  });

  it("在庫なし・受取終了まで30分未満・翌日受取・価格が不正な商品は除く", () => {
    expect(isDigestEligible(cand(), NOW)).toBe(true);
    expect(isDigestEligible(cand({ remaining: 0 }), NOW)).toBe(false);
    expect(isDigestEligible(cand({ pickupStartAt: "2026-10-24T16:00:00+09:00", pickupEndAt: "2026-10-24T17:20:00+09:00" }), NOW)).toBe(false);
    expect(isDigestEligible(cand({ pickupStartAt: "2026-10-25T10:00:00+09:00", pickupEndAt: "2026-10-25T12:00:00+09:00" }), NOW)).toBe(false);
    expect(isDigestEligible(cand({ rescuePrice: 0 }), NOW)).toBe(false);
    expect(isDigestEligible(cand({ originalPrice: 500, rescuePrice: 600 }), NOW)).toBe(false);
    expect(isDigestEligible(cand({ pickupEndAt: "invalid" }), NOW)).toBe(false);
  });

  it("割引率が高い順 → 受取終了が近い順。最大3件", () => {
    const a = cand({ storeId: "s1", rescuePrice: 700 });
    const b = cand({ storeId: "s2", rescuePrice: 400 });
    const c = cand({ storeId: "s3", rescuePrice: 500, pickupEndAt: "2026-10-24T22:00:00+09:00" });
    const d = cand({ storeId: "s4", rescuePrice: 500, pickupEndAt: "2026-10-24T20:00:00+09:00" });
    expect(selectDigestProducts([a, b, c, d], NOW).map((p) => p.id)).toEqual([b.id, d.id, c.id]);
  });

  it("まず1店舗1件ずつ。足りなければ1店舗2件まで（同じ店舗だけで3件にしない）", () => {
    const s1 = [cand({ storeId: "s1", rescuePrice: 100 }), cand({ storeId: "s1", rescuePrice: 150 }), cand({ storeId: "s1", rescuePrice: 200 })];
    const s2 = cand({ storeId: "s2", rescuePrice: 900 });
    expect(selectDigestProducts([...s1, s2], NOW).map((p) => p.id)).toEqual([s1[0].id, s2.id, s1[1].id]);
    expect(selectDigestProducts(s1, NOW)).toHaveLength(2);
  });

  it("直近に送った商品は除く。候補がなければ0件", () => {
    const a = cand({ storeId: "s1" });
    const b = cand({ storeId: "s2" });
    expect(selectDigestProducts([a, b], NOW, [a.id]).map((p) => p.id)).toEqual([b.id]);
    expect(selectDigestProducts([a, b], NOW, [a.id, b.id])).toEqual([]);
    expect(selectDigestProducts([], NOW)).toEqual([]);
  });

  it("Flex Message: 「今夜の食べつなぎ」のカルーセル（最大3商品・各商品に「商品を見る」→ LINE ミニアプリの商品詳細）", () => {
    const products = [cand({ storeId: "s1" }), cand({ storeId: "s2", imageUrl: "https://cdn.example/a.jpg" }), cand({ storeId: "s3" })];
    const cards = digestCards(products, { liffId: "2000000000-AbCdEfGh", appUrl: "https://x.example", now: NOW });
    const m = digestFlexMessage(cards) as { type: string; altText: string; contents: { type: string; contents: Record<string, unknown>[] } };
    expect(m.type).toBe("flex");
    expect(m.contents.type).toBe("carousel");
    expect(m.contents.contents).toHaveLength(3);
    expect(m.altText.startsWith("今夜の食べつなぎ")).toBe(true);
    expect(cards[0]).toMatchObject({ title: "今夜の食べつなぎ", priceLine: "1,000円相当 → 600円", discount: "40%OFF", remaining: "残り2点" });
    expect(m.contents.contents[1].hero).toBeDefined();
    const json = JSON.stringify(m);
    expect(json).toContain(`https://miniapp.line.me/2000000000-AbCdEfGh/products/${products[0].id}`);
    expect(json).not.toMatch(/liff\.line\.me|line:\/\//);
  });
});

// ---------------------------------------------------------------------------
// 配信（DB・LINE API はモック）
// ---------------------------------------------------------------------------
let driver: Driver | undefined;
type Call = { url: string; method: string; headers: Record<string, string>; body: Record<string, unknown> | null };
let calls: Call[] = [];

/** LINE API のモック。profile: 友だち確認の状態コード（ユーザーごと）、push: Push の状態コード */
function mockLine(opts: { push?: number; profile?: Record<string, number> } = {}) {
  calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (url.startsWith("https://api.line.me/v2/bot/profile/")) {
      const id = decodeURIComponent(url.split("/").pop()!);
      const status = opts.profile?.[id] ?? 200;
      return new Response(status === 200 ? JSON.stringify({ userId: id }) : JSON.stringify({ message: "Not found" }), { status });
    }
    const status = opts.push ?? 200;
    return new Response(status === 200 ? "{}" : JSON.stringify({ message: `error ${LINE_A}` }), { status });
  });
}
const pushes = () => calls.filter((c) => c.url === "https://api.line.me/v2/bot/message/push");
const logs = () =>
  asService((q) =>
    q.query<{ target_user_id: string; notification_type: string; status: string; error_category: string | null; products: string | null; delivery_date: string }>(
      `select target_user_id, notification_type, status, error_category, array_to_string(product_ids, ',') as products, delivery_date::text
       from public.line_push_message_logs order by created_at`,
    ),
  );
async function optIn(userId: string, lineUserId: string) {
  await asService((q) => q.query("update public.users set line_user_id = $2 where id = $1", [userId, lineUserId]));
  await setFeaturedOptIn(userId, true);
}

describe("日次通知（オプトインしたユーザーだけ）", () => {
  let products: string[];
  beforeEach(async () => {
    await driver?.close();
    driver = await createTestDb();
    setEnv(LIVE);
    products = [
      await createProduct(IDS.storeA, { price: 600, endIn: 180 }),
      await createProduct(IDS.storeB, { price: 700, endIn: 180 }),
      await createProduct(IDS.storeA, { price: 800, endIn: 180 }),
      await createProduct(IDS.storeB, { price: 900, endIn: 180 }),
    ];
    session.userId = IDS.admin;
    session.admin = true;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setEnv({});
  });
  afterAll(async () => {
    await driver?.close();
  });

  it("既定は OFF。OFF のユーザーには送らない。ON にしたユーザーにだけ送る", async () => {
    mockLine();
    await asService((q) => q.query("update public.users set line_user_id = $2 where id = $1", [IDS.userB, LINE_B]));
    await optIn(IDS.userA, LINE_A);
    const r = await runFeaturedDigest();
    expect(r).toMatchObject({ mode: "live", targets: 1, sent: 1, failed: 0 });
    expect(pushes()).toHaveLength(1);
    expect(pushes()[0].body?.to).toBe(LINE_A);
    const [row] = await asService((q) => q.query<{ on: boolean }>("select line_featured_opt_in as on from public.users where id = $1", [IDS.userB]));
    expect(row.on).toBe(false);
  });

  it("送るのは最大3商品のカルーセル。Broadcast / Multicast は使わない。同じ店舗に偏らない", async () => {
    mockLine();
    await optIn(IDS.userA, LINE_A);
    await runFeaturedDigest();
    const message = (pushes()[0].body?.messages as { contents: { type: string; contents: unknown[] } }[])[0];
    expect(message.contents.type).toBe("carousel");
    expect(message.contents.contents).toHaveLength(3);
    expect(calls.some((c) => /multicast|broadcast|narrowcast/.test(c.url))).toBe(false);
    const [log] = await logs();
    expect(log.products?.split(",")).toEqual([products[0], products[1], products[2]]);
    expect(pushes()[0].headers["x-line-retry-key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("デモユーザー・LINE の userId がない人・形式が不正な userId は除く", async () => {
    mockLine();
    await optIn(IDS.userA, LINE_A);
    await asService((q) => q.query("update public.users set is_demo = true where id = $1", [IDS.userA]));
    await optIn(IDS.userB, "not-a-line-id");
    expect(await runFeaturedDigest()).toMatchObject({ targets: 0, sent: 0 });
    expect(calls).toHaveLength(0);
  });

  it("LINE でログインしていない人は ON にできない", async () => {
    await expect(setFeaturedOptIn(IDS.userA, true)).rejects.toMatchObject({ code: "validation" });
    session.userId = IDS.userA;
    session.admin = false;
    expect(await setLineFeaturedOptInAction(null, formOf({ on: "true" }))).toMatchObject({ ok: false });
    await asService((q) => q.query("update public.users set line_user_id = $2 where id = $1", [IDS.userA, LINE_A]));
    expect(await setLineFeaturedOptInAction(null, formOf({ on: "true" }))).toMatchObject({ ok: true });
    const [row] = await asService((q) =>
      q.query<{ on: boolean; at: Date | null }>("select line_featured_opt_in as on, line_featured_opt_in_at as at from public.users where id = $1", [IDS.userA]),
    );
    expect(row.on).toBe(true);
    expect(row.at).not.toBeNull();
    expect(await setLineFeaturedOptInAction(null, formOf({ on: "false" }))).toMatchObject({ ok: true });
  });

  it("1人1日1回まで（同じ日にもう一度実行しても送らない）。翌日は直近に送った商品を除いて送る", async () => {
    mockLine();
    await optIn(IDS.userA, LINE_A);
    const now = new Date();
    expect(await runFeaturedDigest(now)).toMatchObject({ sent: 1 });
    expect(await runFeaturedDigest(now)).toMatchObject({ targets: 0, sent: 0 });
    expect(pushes()).toHaveLength(1);
    // 翌日（同じ商品がまだ受付中だとしても、直近に送った商品は除く）
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000);
    await asService((q) =>
      q.query("update public.products set pickup_start_at = $1::timestamptz - interval '10 minutes', pickup_end_at = $1::timestamptz + interval '3 hours'", [
        tomorrow.toISOString(),
      ]),
    );
    expect(await runFeaturedDigest(tomorrow)).toMatchObject({ sent: 1 });
    const second = (await logs()).filter((l) => l.status === "sent")[1];
    expect(second.products?.split(",")).toEqual([products[3]]);
  });

  it("今日の商品が0件なら誰にも送らない（終了・売り切れ・停止中の店舗・非公開は対象外）", async () => {
    mockLine();
    await optIn(IDS.userA, LINE_A);
    await asService(async (q) => {
      await q.query("update public.products set remaining_quantity = 0 where id = $1", [products[0]]);
      await q.query("update public.products set status = 'closed' where id = $1", [products[1]]);
      await q.query("update public.products set pickup_end_at = now() + interval '10 minutes' where id = $1", [products[2]]);
      await q.query("update public.products set deleted_at = now() where id = $1", [products[3]]);
    });
    await createProduct(IDS.storeSuspended, { price: 500, endIn: 180 });
    expect(await runFeaturedDigest()).toMatchObject({ products: 0, targets: 0, sent: 0 });
    expect(calls).toHaveLength(0);
    expect(await logs()).toHaveLength(0);
  });

  it("ENABLE_LINE_DIGEST_SEND が true でなければ dry run（トークンがあっても LINE に問い合わせない）", async () => {
    mockLine();
    await optIn(IDS.userA, LINE_A);
    setEnv({ ...LIVE, ENABLE_LINE_DIGEST_SEND: undefined });
    expect(await runFeaturedDigest()).toMatchObject({ mode: "dry_run", targets: 1, dryRun: 1, sent: 0 });
    setEnv({ ...LIVE, ENABLE_LINE_DIGEST_SEND: "false", APP_ENV: "production" });
    expect(await runFeaturedDigest()).toMatchObject({ mode: "dry_run", dryRun: 1 });
    expect(calls).toHaveLength(0);
    expect((await logs()).map((l) => l.status)).toEqual(["dry_run", "dry_run"]);
    // dry run は「今日送った」に数えない（実送信に切り替えた日は送れる）
    setEnv(LIVE);
    expect(await runFeaturedDigest()).toMatchObject({ mode: "live", sent: 1 });
  });

  it("友だち未追加・ブロック中（プロフィールが 404）なら送らない（送信せず）", async () => {
    mockLine({ profile: { [LINE_A]: 404 } });
    await optIn(IDS.userA, LINE_A);
    await optIn(IDS.userB, LINE_B);
    expect(await runFeaturedDigest()).toMatchObject({ sent: 1, skipped: 1 });
    expect(pushes().map((p) => p.body?.to)).toEqual([LINE_B]);
    expect((await logs()).find((l) => l.target_user_id === IDS.userA)).toMatchObject({ status: "skipped", error_category: "not_friend" });
  });

  it("Messaging API の失敗: その日は再送しない。連続3回失敗したら、ON にし直すまで送らない。トークン・userId を記録しない", async () => {
    mockLine({ push: 500 });
    await optIn(IDS.userA, LINE_A);
    const day = (n: number) => new Date(Date.now() + n * 24 * 60 * 60_000);
    for (let i = 0; i < DIGEST_MAX_CONSECUTIVE_FAILURES; i += 1) {
      await asService((q) =>
        q.query("update public.products set pickup_start_at = $1::timestamptz - interval '10 minutes', pickup_end_at = $1::timestamptz + interval '3 hours'", [
          day(i).toISOString(),
        ]),
      );
      // 直近に送った商品の除外は「送信済み」だけが対象なので、失敗した商品は翌日も候補になる
      expect(await runFeaturedDigest(day(i))).toMatchObject({ failed: 1 });
      expect(await runFeaturedDigest(day(i))).toMatchObject({ targets: 0 });
    }
    await asService((q) =>
      q.query("update public.products set pickup_start_at = $1::timestamptz - interval '10 minutes', pickup_end_at = $1::timestamptz + interval '3 hours'", [
        day(3).toISOString(),
      ]),
    );
    expect(await runFeaturedDigest(day(3))).toMatchObject({ targets: 0 });
    expect(pushes()).toHaveLength(DIGEST_MAX_CONSECUTIVE_FAILURES);
    // 本人が ON にし直すと、また対象になる
    await setFeaturedOptIn(IDS.userA, true);
    expect(await runFeaturedDigest(day(3))).toMatchObject({ targets: 1 });
    const text = JSON.stringify(await logs());
    expect(text).not.toContain(ACCESS_TOKEN);
    expect(text).not.toContain(LINE_A);
  });

  it("認証エラー（401）などは、その回の実行を止める（ほかのユーザーにも送り続けない）", async () => {
    mockLine({ push: 401 });
    await optIn(IDS.userA, LINE_A);
    await optIn(IDS.userB, LINE_B);
    expect(await runFeaturedDigest()).toMatchObject({ failed: 1, aborted: "unauthorized" });
    expect(pushes()).toHaveLength(1);
  });

  it("手動実行・自分へのテスト送信は管理者だけ", async () => {
    mockLine();
    await optIn(IDS.userA, LINE_A);
    session.userId = IDS.userA;
    session.admin = false;
    expect(await runDigestNowAction()).toMatchObject({ ok: false, code: "forbidden" });
    expect(await sendDigestTestAction()).toMatchObject({ ok: false, code: "forbidden" });
    expect(calls).toHaveLength(0);
    session.userId = IDS.admin;
    session.admin = true;
    setEnv({ ...LIVE, ENABLE_LINE_DIGEST_SEND: undefined });
    expect(await runDigestNowAction()).toMatchObject({ ok: true, message: expect.stringContaining("dry run") });
    expect(calls).toHaveLength(0);
  });

  it("自分へのテスト送信: 管理者本人の LINE にだけ1件。オプトインしたほかのユーザーには送らない。連打しても二重に送らない", async () => {
    mockLine();
    await optIn(IDS.userA, LINE_A);
    await asService((q) => q.query("update public.users set line_user_id = $2 where id = $1", [IDS.admin, LINE_ADMIN]));
    setEnv({ ...LIVE, ENABLE_LINE_DIGEST_SEND: undefined, ENABLE_LINE_MARKETING_DEMO: "true" });
    expect(await sendDigestTestAction()).toMatchObject({ ok: true });
    expect(await sendDigestTestAction()).toMatchObject({ ok: false, code: "duplicate" });
    expect(pushes().map((p) => p.body?.to)).toEqual([LINE_ADMIN]);
    // テスト送信は日次の「今日送った」に数えない
    expect((await logs()).every((l) => l.notification_type === "featured_daily_test")).toBe(true);
    // フラグがなければ送らない
    setEnv({ ...LIVE, ENABLE_LINE_DIGEST_SEND: undefined });
    expect(await sendDigestTestToSelf(IDS.admin)).toEqual({ ok: false, category: "not_enabled" });
  });

  it("管理画面の集計: 通知ON・対象・今日の結果・今日の商品。LINE の userId・トークンは含めない", async () => {
    mockLine({ profile: { [LINE_B]: 404 } });
    await optIn(IDS.userA, LINE_A);
    await optIn(IDS.userB, LINE_B);
    await asService((q) => q.query("update public.users set line_featured_opt_in = true, is_demo = true where id = $1", [IDS.staffA]));
    await runFeaturedDigest();
    const d = await getDigestDashboard();
    expect(d).toMatchObject({ optIn: 3, eligible: 2, demoOptIn: 1, today: { sent: 1, failed: 0, skipped: 1 } });
    expect(d.cards).toHaveLength(3);
    const text = JSON.stringify(d);
    expect(text).not.toContain(LINE_A);
    expect(text).not.toContain(LINE_B);
    expect(text).not.toContain(ACCESS_TOKEN);
  });

  it("定期処理: ENABLE_LINE_DIGEST_CRON=true でなければ何もしない。有効でも送信フラグがなければ dry run", async () => {
    mockLine();
    await optIn(IDS.userA, LINE_A);
    const req = () => new Request("http://localhost/api/cron/digest", { headers: { authorization: "Bearer cron-secret" } });
    setEnv({ ...LIVE, CRON_SECRET: "cron-secret" });
    expect(await (await cronDigestGET(req())).json()).toEqual({ ok: true, skipped: "cron_disabled" });
    expect((await cronDigestGET(new Request("http://localhost/api/cron/digest"))).status).toBe(401);
    setEnv({ ...LIVE, CRON_SECRET: "cron-secret", ENABLE_LINE_DIGEST_CRON: "true", ENABLE_LINE_DIGEST_SEND: undefined });
    expect((await (await cronDigestGET(req())).json()).result).toMatchObject({ mode: "dry_run", dryRun: 1 });
    expect(calls).toHaveLength(0);
  });

  it("旧まとめ通知（全員が既定で ON）は、送信フラグが true でも LINE へ送らない（記録のみ）", async () => {
    mockLine();
    await asService((q) => q.query("update public.users set line_user_id = $2, notify_enabled = true where id = $1", [IDS.userA, LINE_A]));
    expect((await sendEveningDigest(null)).status).toBe("dry_run");
    expect(calls).toHaveLength(0);
  });
});

function formOf(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}
