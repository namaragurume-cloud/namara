import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildParams, isValidTemplateName, parseParamMapping } from "@/lib/service-message";
import { asService } from "@/server/db";
import type { Driver } from "@/server/db/types";
import { env } from "@/server/env";
import { resetChannelTokenCache } from "@/server/line/service-message";
import { sendDemoOrderCompleted } from "@/server/services/line-notifications";
import { createTestDb, IDS } from "./support/db";

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
const { sendLineDemoAction } = await import("@/app/actions/line-demo");

/** LINE ミニアプリのサービスメッセージ（デモ）。LINE の API はモック（実際には送信しない） */
const ENV_KEYS = [
  "APP_ENV",
  "ENABLE_LINE_NOTIFICATION_DEMO",
  "LINE_MINIAPP_CHANNEL_ID",
  "LINE_MINIAPP_CHANNEL_SECRET",
  "LINE_SERVICE_MESSAGE_ORDER_TEMPLATE",
  "LINE_SERVICE_MESSAGE_ORDER_PARAMS",
] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const SECRET = "miniapp-channel-secret-should-not-leak";
function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const k of ENV_KEYS) {
    const v = k in values ? values[k] : saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}
const READY = {
  APP_ENV: "preview",
  ENABLE_LINE_NOTIFICATION_DEMO: "true",
  LINE_MINIAPP_CHANNEL_ID: "2000000000",
  LINE_MINIAPP_CHANNEL_SECRET: SECRET,
  LINE_SERVICE_MESSAGE_ORDER_TEMPLATE: "order_complete_ja",
  LINE_SERVICE_MESSAGE_ORDER_PARAMS: JSON.stringify({ shop_name: "storeName", item_name: "items", pickup_time: "pickup", btn1_url: "orderPath" }),
};

type Call = { url: string; body: string; auth: string | null };
let calls: Call[] = [];
/** LINE API のモック。送信のたびに新しいトークンを返す */
function mockLine(opts: { sendStatus?: number; issueStatus?: number } = {}) {
  let seq = 0;
  calls = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === "string" ? init.body : String(init?.body ?? "");
    const auth = new Headers(init?.headers).get("authorization");
    calls.push({ url, body, auth });
    const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
    if (url.endsWith("/oauth2/v3/token")) return json(200, { access_token: "channel-token-x", expires_in: 900, token_type: "Bearer" });
    if (url.endsWith("/message/v3/notifier/token")) {
      if (opts.issueStatus) return json(opts.issueStatus, { message: "error" });
      return json(200, { notificationToken: "nt-issued", expiresIn: 31_536_000, remainingCount: 5, sessionId: "sess-1" });
    }
    if (url.includes("/message/v3/notifier/send?target=service")) {
      if (opts.sendStatus) return json(opts.sendStatus, { message: "error" });
      seq += 1;
      return json(200, { notificationToken: `nt-renewed-${seq}`, expiresIn: 31_536_000, remainingCount: 5 - seq, sessionId: "sess-1" });
    }
    return json(404, {});
  });
}

const tokens = () =>
  asService((q) => q.query<{ token: string; remaining_count: number }>("select token, remaining_count from public.line_service_notification_tokens order by created_at"));
const logs = () =>
  asService((q) => q.query<Record<string, unknown>>("select * from public.line_service_message_logs order by created_at"));

describe("テンプレートの設定（自由文は送らない）", () => {
  it("テンプレート名は {名前}_{言語タグ}・30文字以内", () => {
    expect(isValidTemplateName("order_complete_ja")).toBe(true);
    expect(isValidTemplateName("reservation_confirmation_d_ja")).toBe(true);
    expect(isValidTemplateName("order complete")).toBe(false);
    expect(isValidTemplateName(`${"a".repeat(28)}_ja`)).toBe(false);
  });
  it("変数の対応は決められた項目だけ（自由文・未知の項目・不正な JSON は拒否）", () => {
    expect(parseParamMapping('{"shop_name":"storeName","btn1_url":"orderPath"}')).toEqual({ shop_name: "storeName", btn1_url: "orderPath" });
    expect(parseParamMapping('{"title":"本日限定セール！"}')).toBeNull();
    expect(parseParamMapping('{"x":"lineUserId"}')).toBeNull();
    expect(parseParamMapping("not json")).toBeNull();
    expect(parseParamMapping("")).toBeNull();
  });
  it("値は短く切る", () => {
    const p = buildParams({ item_name: "items" }, { storeName: "", items: "あ".repeat(80), pickup: "", orderNumber: "", total: "", orderPath: "" }, 50);
    expect(p.item_name).toHaveLength(50);
  });
});

describe("安全装置", () => {
  afterEach(() => setEnv({}));
  it("本番では ENABLE_LINE_NOTIFICATION_DEMO=true でも無効。既定も無効", () => {
    setEnv({ ...READY, APP_ENV: "production" });
    expect(env.line.serviceMessageDemoEnabled).toBe(false);
    setEnv({ ...READY, ENABLE_LINE_NOTIFICATION_DEMO: undefined });
    expect(env.line.serviceMessageDemoEnabled).toBe(false);
    setEnv(READY);
    expect(env.line.serviceMessageDemoEnabled).toBe(true);
  });
});

let driver: Driver | undefined;

describe("デモ送信（DB・LINE API はモック）", () => {
  beforeEach(async () => {
    await driver?.close();
    driver = await createTestDb();
    setEnv(READY);
    resetChannelTokenCache();
    await asService((q) => q.query("update public.users set line_user_id = 'U-admin-test' where id = $1", [IDS.admin]));
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

  it("管理者以外は送れない", async () => {
    mockLine();
    session.userId = IDS.userA;
    session.admin = false;
    const res = await sendLineDemoAction(null, new FormData());
    expect(res).toMatchObject({ ok: false, code: "forbidden" });
    expect(calls).toHaveLength(0);
  });

  it("本番ではデモ送信できない（LINE に問い合わせない）", async () => {
    mockLine();
    setEnv({ ...READY, APP_ENV: "production" });
    const res = await sendLineDemoAction(null, new FormData());
    expect(res).toMatchObject({ ok: false, message: "LINE通知を送信できませんでした。このデモは有効になっていません。" });
    expect(calls).toHaveLength(0);
  });

  it("トークンがない（LINE アプリ外・未発行）と送らず、記録だけ残す", async () => {
    mockLine();
    const res = await sendDemoOrderCompleted(IDS.admin, null);
    expect(res).toEqual({ ok: false, category: "no_token" });
    expect(calls.some((c) => c.url.includes("/notifier/send"))).toBe(false);
    expect((await logs()).map((l) => [l.status, l.error_category])).toEqual([["failed", "no_token"]]);
  });

  it("LIFF アクセストークン → サービス通知トークンを発行して送信。送信後は返ってきた新しいトークンに更新し、次はそれを使う", async () => {
    mockLine();
    const fd = new FormData();
    fd.set("liffAccessToken", "liff-access-token-abc");
    const res = await sendLineDemoAction(null, fd);
    expect(res).toMatchObject({ ok: true, message: "LINEへテスト通知を送信しました。" });

    const issue = calls.find((c) => c.url.endsWith("/notifier/token"))!;
    expect(JSON.parse(issue.body)).toEqual({ liffAccessToken: "liff-access-token-abc" });
    expect(issue.auth).toBe("Bearer channel-token-x");
    const send = calls.find((c) => c.url.includes("/notifier/send"))!;
    const body = JSON.parse(send.body);
    expect(body.templateName).toBe("order_complete_ja");
    expect(body.notificationToken).toBe("nt-issued");
    expect(Object.keys(body.params).sort()).toEqual(["btn1_url", "item_name", "pickup_time", "shop_name"]);
    expect(body.params.item_name).toContain("食べつなぎBOX");

    expect(await tokens()).toEqual([{ token: "nt-renewed-1", remaining_count: 4 }]);
    // 2回目（1分以上あと・LIFF アクセストークンなし）: 更新後のトークンで送る
    const later = new Date(Date.now() + 61_000);
    expect(await sendDemoOrderCompleted(IDS.admin, null, later)).toEqual({ ok: true });
    const second = calls.filter((c) => c.url.includes("/notifier/send"))[1];
    expect(JSON.parse(second.body).notificationToken).toBe("nt-renewed-1");
    expect(await tokens()).toEqual([{ token: "nt-renewed-2", remaining_count: 3 }]);
    // LIFF アクセストークンは保存しない
    const stored = JSON.stringify(await asService((q) => q.query("select * from public.line_service_notification_tokens")));
    expect(stored).not.toContain("liff-access-token-abc");
  });

  it("続けて押しても二重に送らない（1分以内は送信しない）", async () => {
    mockLine();
    const fd = new FormData();
    fd.set("liffAccessToken", "liff-1");
    expect(await sendLineDemoAction(null, fd)).toMatchObject({ ok: true });
    const again = await sendLineDemoAction(null, fd);
    expect(again).toMatchObject({ ok: false, code: "duplicate" });
    expect(calls.filter((c) => c.url.includes("/notifier/send"))).toHaveLength(1);
  });

  it("レスポンス・記録・画面の文言にトークンやシークレットを含めない", async () => {
    mockLine();
    const fd = new FormData();
    fd.set("liffAccessToken", "liff-secret-token");
    const res = await sendLineDemoAction(null, fd);
    const text = JSON.stringify(res) + JSON.stringify(await logs());
    for (const s of ["liff-secret-token", "nt-issued", "nt-renewed", "channel-token-x", SECRET]) expect(text).not.toContain(s);
  });

  it("LINE API のエラー: 送信が 500 → 失敗（line_unavailable）を記録し、技術的な詳細は返さない", async () => {
    mockLine({ sendStatus: 500 });
    const fd = new FormData();
    fd.set("liffAccessToken", "liff-2");
    const res = await sendLineDemoAction(null, fd);
    expect(res).toMatchObject({ ok: false, message: "LINE通知を送信できませんでした。", code: "line_unavailable" });
    expect((await logs()).at(-1)).toMatchObject({ status: "failed", error_category: "line_unavailable" });
  });

  it("LINE API のエラー: 使えないトークン（400）は以後使わない。発行の失敗（401）も失敗として記録", async () => {
    mockLine({ sendStatus: 400 });
    expect(await sendDemoOrderCompleted(IDS.admin, "liff-3")).toEqual({ ok: false, category: "bad_request" });
    expect((await tokens())[0].remaining_count).toBe(0);
    vi.restoreAllMocks();
    mockLine({ issueStatus: 401 });
    expect(await sendDemoOrderCompleted(IDS.admin, "liff-4", new Date(Date.now() + 61_000))).toEqual({ ok: false, category: "unauthorized" });
  });

  it("LINE でログインしていないアカウント・テンプレート未設定では送らない", async () => {
    mockLine();
    await asService((q) => q.query("update public.users set line_user_id = null where id = $1", [IDS.admin]));
    expect(await sendDemoOrderCompleted(IDS.admin, "liff-5")).toEqual({ ok: false, category: "not_line_user" });
    setEnv({ ...READY, LINE_SERVICE_MESSAGE_ORDER_PARAMS: '{"title":"セール"}' });
    expect(await sendDemoOrderCompleted(IDS.admin, "liff-5")).toEqual({ ok: false, category: "not_configured" });
    expect(calls).toHaveLength(0);
  });
});
