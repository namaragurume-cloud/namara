import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { featuredCard, featuredFlexMessage, flexImageUrl, productDeepLink, type FeaturedProduct } from "@/lib/featured-message";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { env } from "@/server/env";
import { sendFeaturedProductDemo } from "@/server/services/line-marketing";
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
  };
});
const { sendFeaturedProductDemoAction } = await import("@/app/actions/line-marketing-demo");

/** 「今日の食べつなぎ」（注目商品）を LINE 公式アカウントから自分に送るデモ。LINE の API はモック */
const ENV_KEYS = ["APP_ENV", "ENABLE_LINE_MARKETING_DEMO", "LINE_CHANNEL_ACCESS_TOKEN", "NEXT_PUBLIC_LIFF_ID", "ENABLE_LINE_DIGEST_SEND"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const ACCESS_TOKEN = "messaging-channel-access-token-should-not-leak";
function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const k of ENV_KEYS) {
    const v = k in values ? values[k] : saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}
const READY = { APP_ENV: "preview", ENABLE_LINE_MARKETING_DEMO: "true", LINE_CHANNEL_ACCESS_TOKEN: ACCESS_TOKEN, NEXT_PUBLIC_LIFF_ID: "2000000000-AbCdEfGh" };
const LINE_USER = `U${"a".repeat(32)}`;

const product: FeaturedProduct = {
  id: "11111111-2222-4333-8444-555555555555",
  name: "本日のケーキ 食べつなぎBOX",
  storeName: "札幌スイーツラボ",
  imageUrl: "https://example.supabase.co/storage/v1/object/public/products/cake.jpg",
  originalPrice: 2400,
  rescuePrice: 1200,
  remaining: 3,
  isBox: true,
  pickupStartAt: "2026-10-24T20:30:00+09:00",
  pickupEndAt: "2026-10-24T23:30:00+09:00",
};

describe("カードの内容・Flex Message・リンク", () => {
  const now = new Date("2026-10-24T12:00:00+09:00");
  it("店舗名・商品名・○円相当 → 価格・お得率・残り・受取時間・「商品を見る」", () => {
    const c = featuredCard(product, { liffId: READY.NEXT_PUBLIC_LIFF_ID, appUrl: "https://tabetunagu.example", now });
    expect(c).toMatchObject({
      title: "今日の食べつなぎ",
      storeName: "札幌スイーツラボ",
      productName: "本日のケーキ 食べつなぎBOX",
      priceLine: "2,400円相当 → 1,200円",
      discount: "50%OFF",
      remaining: "残り3BOX",
      pickup: "本日 20:30〜23:30",
      ctaLabel: "商品を見る",
    });
  });
  it("リンクは LINE ミニアプリの URL（miniapp.line.me）。LIFF がなければ Web の URL。旧形式は使わない", () => {
    expect(productDeepLink(product.id, { liffId: "2000000000-AbCdEfGh", appUrl: "https://x.example" })).toBe(
      `https://miniapp.line.me/2000000000-AbCdEfGh/products/${product.id}`,
    );
    expect(productDeepLink(product.id, { liffId: "", appUrl: "https://x.example/" })).toBe(`https://x.example/products/${product.id}`);
    const flex = JSON.stringify(featuredFlexMessage(featuredCard(product, { liffId: "2000000000-AbCdEfGh", appUrl: "https://x.example", now })));
    expect(flex).not.toMatch(/liff\.line\.me|line:\/\//);
  });
  it("画像は https の JPEG / PNG だけ（WebP・相対パスで http のものは画像なし）", () => {
    expect(flexImageUrl("https://cdn.example/a.png", "https://x.example")).toBe("https://cdn.example/a.png");
    expect(flexImageUrl("/demo/cake.webp", "https://x.example")).toBeNull();
    expect(flexImageUrl("/demo/cake.jpg", "http://localhost:3000")).toBeNull();
    expect(flexImageUrl("/demo/cake.jpg", "https://x.example")).toBe("https://x.example/demo/cake.jpg");
    expect(flexImageUrl(null, "https://x.example")).toBeNull();
  });
  it("Flex Message: 1商品の bubble（画像・本文・ボタン）。ボタンは URI アクション", () => {
    const m = featuredFlexMessage(featuredCard(product, { liffId: "L", appUrl: "https://x.example", now })) as {
      type: string;
      altText: string;
      contents: { type: string; hero?: unknown; footer: { contents: { action: { type: string; uri: string; label: string } }[] } };
    };
    expect(m.type).toBe("flex");
    expect(m.contents.type).toBe("bubble");
    expect(m.contents.hero).toBeDefined();
    expect(m.contents.footer.contents[0].action).toEqual({ type: "uri", label: "商品を見る", uri: `https://miniapp.line.me/L/products/${product.id}` });
    expect(m.altText.length).toBeLessThanOrEqual(400);
  });
  it("ENABLE_LINE_MARKETING_DEMO=true のときだけ有効（本番でも明示的に指定した場合のみ）。既定は無効・まとめ通知の送信は別のフラグ", () => {
    setEnv({ ...READY, APP_ENV: "production", ENABLE_LINE_MARKETING_DEMO: undefined });
    expect(env.line.marketingDemoEnabled).toBe(false);
    setEnv({ ...READY, APP_ENV: "production", ENABLE_LINE_MARKETING_DEMO: "false" });
    expect(env.line.marketingDemoEnabled).toBe(false);
    setEnv({ ...READY, APP_ENV: "production" });
    expect(env.line.marketingDemoEnabled).toBe(true);
    expect(env.line.digestSendEnabled).toBe(false);
    setEnv({});
  });
});

let driver: Driver | undefined;
type Call = { url: string; body: Record<string, unknown>; headers: Headers };
let calls: Call[] = [];
function mockLine(status = 200) {
  calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? "{}")), headers: new Headers(init?.headers) });
    return new Response(status === 200 ? "{}" : JSON.stringify({ message: "The user hasn't added the LINE Official Account as a friend." }), { status });
  });
}

describe("自分へのテスト送信（DB・LINE API はモック）", () => {
  let productId: string;
  beforeEach(async () => {
    await driver?.close();
    driver = await createTestDb();
    setEnv(READY);
    productId = await createProduct(IDS.storeA, { startIn: 30, endIn: 180 });
    await asService((q) => q.query("update public.users set line_user_id = $2 where id = $1", [IDS.admin, LINE_USER]));
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
  const form = (id: string) => {
    const fd = new FormData();
    fd.set("productId", id);
    return fd;
  };
  const logs = () => asService((q) => q.query<Record<string, unknown>>("select * from public.line_push_message_logs order by created_at"));

  it("管理者は自分の LINE（LINE Login の userId）にだけ Push で送る。Broadcast / Multicast は使わない", async () => {
    mockLine();
    const res = await sendFeaturedProductDemoAction(null, form(productId));
    expect(res).toMatchObject({ ok: true, message: "LINEへテスト通知を送信しました。" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.line.me/v2/bot/message/push");
    expect(calls[0].body.to).toBe(LINE_USER);
    expect(calls[0].headers.get("authorization")).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(calls[0].headers.get("x-line-retry-key")).toMatch(/^[0-9a-f-]{36}$/);
    const msg = (calls[0].body.messages as { type: string; contents: { footer: { contents: { action: { uri: string } }[] } } }[])[0];
    expect(msg.type).toBe("flex");
    expect(msg.contents.footer.contents[0].action.uri).toBe(`https://miniapp.line.me/${READY.NEXT_PUBLIC_LIFF_ID}/products/${productId}`);
    const [log] = await logs();
    expect(log).toMatchObject({ notification_type: "featured_product_demo", product_id: productId, target_user_id: IDS.admin, status: "sent" });
    expect(JSON.stringify(log)).not.toContain(LINE_USER);
  });

  it("一般ユーザーは送れない", async () => {
    mockLine();
    session.userId = IDS.userA;
    session.admin = false;
    expect(await sendFeaturedProductDemoAction(null, form(productId))).toMatchObject({ ok: false, code: "forbidden" });
    expect(calls).toHaveLength(0);
  });

  it("フラグがなければ送れない（本番の既定。LINE に問い合わせない）", async () => {
    mockLine();
    setEnv({ ...READY, APP_ENV: "production", ENABLE_LINE_MARKETING_DEMO: undefined });
    expect(await sendFeaturedProductDemoAction(null, form(productId))).toMatchObject({ ok: false, code: "not_enabled" });
    expect(calls).toHaveLength(0);
  });

  it("本番で明示的に有効にしても、送れるのは管理者本人への Push 1件だけ。一般ユーザーは不可・まとめ通知（Multicast）は送らない", async () => {
    mockLine();
    setEnv({ ...READY, APP_ENV: "production" });
    await asService((q) => q.query("update public.users set line_user_id = $2, notify_enabled = true where id = $1", [IDS.userA, `U${"c".repeat(32)}`]));
    expect(await sendFeaturedProductDemoAction(null, form(productId))).toMatchObject({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.line.me/v2/bot/message/push");
    expect(calls[0].body.to).toBe(LINE_USER);
    // 一般ユーザーは本番でも送れない
    session.userId = IDS.userA;
    session.admin = false;
    expect(await sendFeaturedProductDemoAction(null, form(productId))).toMatchObject({ ok: false, code: "forbidden" });
    // まとめ通知（全員への配信・定期処理）は ENABLE_LINE_DIGEST_SEND がない限り送らない
    expect((await sendEveningDigest(null)).status).toBe("dry_run");
    expect(calls).toHaveLength(1);
    expect(calls.some((c) => /multicast|broadcast|narrowcast/.test(c.url))).toBe(false);
  });

  it("商品なし・公開されていない商品・不正な ID は送らない", async () => {
    mockLine();
    expect(await sendFeaturedProductDemoAction(null, form("not-a-uuid"))).toMatchObject({ ok: false });
    expect(await sendFeaturedProductDemo(IDS.admin, "00000000-0000-4000-8000-00000000ffff")).toEqual({ ok: false, category: "product_not_found" });
    await asService((q) => q.query("update public.products set status = 'closed' where id = $1", [productId]));
    expect(await sendFeaturedProductDemo(IDS.admin, productId)).toEqual({ ok: false, category: "product_not_found" });
    expect(calls).toHaveLength(0);
  });

  it("LINE でログインしていない（userId なし）・アクセストークン未設定では送らない", async () => {
    mockLine();
    setEnv({ ...READY, LINE_CHANNEL_ACCESS_TOKEN: undefined });
    expect(await sendFeaturedProductDemo(IDS.admin, productId)).toEqual({ ok: false, category: "not_configured" });
    setEnv(READY);
    await asService((q) => q.query("update public.users set line_user_id = null where id = $1", [IDS.admin]));
    expect(await sendFeaturedProductDemo(IDS.admin, productId)).toEqual({ ok: false, category: "not_line_user" });
    expect(calls).toHaveLength(0);
  });

  it("連打しても二重に送らない（1分以内・同じ商品は10分以内）", async () => {
    mockLine();
    const now = new Date();
    expect(await sendFeaturedProductDemo(IDS.admin, productId, now)).toEqual({ ok: true });
    expect(await sendFeaturedProductDemo(IDS.admin, productId, now)).toEqual({ ok: false, category: "duplicate" });
    expect(await sendFeaturedProductDemo(IDS.admin, productId, new Date(now.getTime() + 2 * 60_000))).toEqual({ ok: false, category: "duplicate" });
    expect(calls).toHaveLength(1);
  });

  it("LINE API のエラー（友だち未追加など 400 / 権限 403 / 500）は「送信できませんでした」だけを返し、トークンを出さない", async () => {
    mockLine(400);
    const res = await sendFeaturedProductDemoAction(null, form(productId));
    expect(res).toMatchObject({ ok: false, message: "LINEテスト通知を送信できませんでした。", code: "bad_request" });
    const text = JSON.stringify(res) + JSON.stringify(await logs());
    expect(text).not.toContain(ACCESS_TOKEN);
    expect(text).not.toContain(LINE_USER);
    expect(text).not.toContain("friend");
    vi.restoreAllMocks();
    mockLine(403);
    expect(await sendFeaturedProductDemo(IDS.admin, productId)).toEqual({ ok: false, category: "forbidden" });
    vi.restoreAllMocks();
    mockLine(500);
    expect(await sendFeaturedProductDemo(IDS.admin, productId)).toEqual({ ok: false, category: "line_unavailable" });
    expect((await logs()).map((l) => l.status)).toEqual(["failed", "failed", "failed"]);
  });

  it("デモのためにアクセストークンを設定しても、まとめ通知（全員への Multicast・定期処理）は送らない（ENABLE_LINE_DIGEST_SEND=true のときだけ）", async () => {
    mockLine();
    await asService((q) => q.query("update public.users set line_user_id = $2, notify_enabled = true where id = $1", [IDS.userA, `U${"b".repeat(32)}`]));
    expect(env.line.digestSendEnabled).toBe(false);
    const r = await sendEveningDigest(null);
    expect(r.status).toBe("dry_run");
    expect(calls).toHaveLength(0);
  });
});
