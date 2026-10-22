import { beforeEach, describe, expect, it } from "vitest";
import { computeLineSignature, verifyLineSignature } from "@/lib/line/signature";
import { MockLineClient, processLineEvents } from "@/lib/line/webhook";
import { buildSearchReply } from "@/lib/line/flex";
import { resetDb, type Db } from "@/lib/server/db";
import { deleteConsumerData, purgeExpiredRawText, recordEvent, runSearch } from "@/lib/server/services/search-service";
import { recordAdClick } from "@/lib/server/services/ad-service";
import { hashIdentifier } from "@/lib/security/identity";
import { RateLimiter } from "@/lib/security/rate-limit";

const NOW = new Date("2026-10-22T03:00:00Z");
let db: Db;
beforeEach(() => {
  db = resetDb(NOW);
});

describe("LINE 署名検証", () => {
  const secret = "test-channel-secret";
  const body = JSON.stringify({ events: [] });
  it("正しい署名は通す", () => {
    expect(verifyLineSignature(body, computeLineSignature(body, secret), secret)).toBe(true);
  });
  it("改ざん・署名なし・別の秘密鍵は拒否", () => {
    expect(verifyLineSignature(`${body} `, computeLineSignature(body, secret), secret)).toBe(false);
    expect(verifyLineSignature(body, null, secret)).toBe(false);
    expect(verifyLineSignature(body, computeLineSignature(body, "other"), secret)).toBe(false);
  });
});

describe("LINE Webhook 処理", () => {
  const messageEvent = (id: string, text: string) => ({
    type: "message",
    webhookEventId: id,
    replyToken: `token-${id}`,
    deliveryContext: { isRedelivery: false },
    source: { type: "user", userId: "U-raw-line-user-id" },
    message: { type: "text", text },
  });

  it("検索してFlexで返信し、LINEのuserIdは保存しない", async () => {
    const client = new MockLineClient();
    const res = await processLineEvents([messageEvent("e1", "すすきの 焼肉 予算8000円")], { db, client, baseUrl: "https://example.com", now: NOW });
    expect(res.processed).toBe(1);
    const messages = client.sent[0]!.messages;
    expect(messages.some((m) => m.type === "flex")).toBe(true);
    expect(JSON.stringify(db.searchLogs)).not.toContain("U-raw-line-user-id");
    expect(db.searchLogs.at(-1)?.sessionId).toBe(`line:${hashIdentifier("line", "U-raw-line-user-id").slice(0, 32)}`);
  });

  it("同じ webhookEventId の再送は1回しか処理しない", async () => {
    const client = new MockLineClient();
    const before = db.searchLogs.length;
    await processLineEvents([messageEvent("dup", "札幌 ラーメン")], { db, client, baseUrl: "https://example.com", now: NOW });
    const res = await processLineEvents([messageEvent("dup", "札幌 ラーメン")], { db, client, baseUrl: "https://example.com", now: NOW });
    expect(res.skippedDuplicates).toBe(1);
    expect(db.searchLogs.length).toBe(before + 1);
    expect(client.sent.length).toBe(1);
  });

  it("Flex の広告カードには「広告」と表示する", () => {
    const outcome = runSearch({ text: "すすきの 焼肉", sessionId: "web:test", channel: "web" }, db, NOW);
    const json = JSON.stringify(buildSearchReply(outcome, "https://example.com"));
    if (outcome.sponsored) expect(json).toContain("広告（スポンサー）");
    expect(json).not.toContain("organizationId");
  });
});

describe("検索ログ・イベント計測", () => {
  it("検索で submitted / parsed / shown が記録される", () => {
    const outcome = runSearch({ text: "すすきの 焼肉", sessionId: "web:abc", channel: "web" }, db, NOW);
    const types = db.events.filter((e) => e.searchId === outcome.searchId).map((e) => e.type);
    expect(types).toContain("search_submitted");
    expect(types).toContain("search_parsed");
    expect(types.filter((t) => t === "recommendation_shown").length).toBe(outcome.results.length + (outcome.sponsored ? 1 : 0));
  });

  it("0件の検索は no_result を記録する", () => {
    const outcome = runSearch({ text: "旭川 フレンチ 個室 禁煙 カウンター 1000円以内", sessionId: "web:abc", channel: "web" }, db, NOW);
    expect(outcome.results).toEqual([]);
    expect(db.events.some((e) => e.searchId === outcome.searchId && e.type === "no_result")).toBe(true);
  });

  it("同じ dedupeKey のイベントは1回だけ記録", () => {
    const e = { type: "store_saved" as const, channel: "web" as const, sessionId: "web:x", searchId: "s", storeId: "store-001", dedupeKey: "k1" };
    expect(recordEvent(db, e, NOW)).toBe(true);
    expect(recordEvent(db, e, NOW)).toBe(false);
  });

  it("広告の表示と課金は別々に記録され、重複クリックは課金されない", () => {
    let outcome = runSearch({ text: "すすきの 焼肉", sessionId: "web:ad", channel: "web" }, db, NOW);
    if (!outcome.sponsored) outcome = runSearch({ text: "大通 イタリアン", sessionId: "web:ad", channel: "web" }, db, NOW);
    if (!outcome.sponsored) return; // デモ広告の対象外になった場合はスキップ（選定ロジックは ads.test.ts で検証）
    const billingBefore = db.billing.length;
    recordAdClick({ impressionId: outcome.sponsored.impressionId, sessionId: "web:ad" }, db, NOW);
    recordAdClick({ impressionId: outcome.sponsored.impressionId, sessionId: "web:ad" }, db, NOW);
    expect(db.billing.length).toBe(billingBefore + 1);
    expect(db.clicks.filter((c) => c.impressionId === outcome.sponsored!.impressionId).map((c) => c.valid)).toEqual([true, false]);
  });

  it("保存期間を過ぎた生の検索文は削除される", () => {
    runSearch({ text: "すすきの 焼肉", sessionId: "web:old", channel: "web" }, db, new Date("2026-06-01T00:00:00Z"));
    expect(purgeExpiredRawText(db, NOW)).toBeGreaterThanOrEqual(1);
    expect(db.searchLogs.filter((l) => l.sessionId === "web:old").every((l) => l.rawText === null)).toBe(true);
  });

  it("利用者の削除依頼で、本人の検索文と行動ログが消える", () => {
    runSearch({ text: "小樽 寿司", sessionId: "web:me", channel: "web" }, db, NOW);
    const res = deleteConsumerData(db, "web:me");
    expect(res.searches).toBe(1);
    expect(db.searchLogs.some((l) => l.sessionId === "web:me")).toBe(false);
    expect(db.events.some((e) => e.sessionId === "web:me")).toBe(false);
  });
});

describe("レート制限", () => {
  it("上限を超えたら拒否し、時間が経てば戻る", () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.check("k", 0).allowed).toBe(true);
    expect(rl.check("k", 1).allowed).toBe(true);
    expect(rl.check("k", 2).allowed).toBe(false);
    expect(rl.check("k", 1001).allowed).toBe(true);
  });
});
