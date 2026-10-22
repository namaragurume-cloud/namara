/**
 * 検索の一連の流れ（推薦処理 1〜9）をまとめるサービス。
 *
 * 1. 検索文を解析 → 2. 条件を正規化 → 3. 必須条件で候補抽出 → 4. 順位付け
 * 5. 情報の新しさを確認 → 6. 上位5店舗 → 7. 条件に合う場合のみ広告枠
 * 8. 結果を返す → 9. 表示・行動を計測
 */
import "server-only";
import { budgetBandOf } from "@/lib/shared/dictionaries";
import type { Channel, InteractionEventType, SearchOutcome } from "@/lib/shared/types";
import { parseSearchText } from "@/lib/search/parser";
import { buildSuggestions, formatBudget, rankStores } from "@/lib/search/ranking";
import { selectSponsored } from "@/lib/ads/selector";
import { getDb, newId, spentByCampaign, type Db } from "../db";

/** 生の検索文の保存期間（日）。期限後は rawText を消して集計用の条件だけ残す */
export const RAW_TEXT_RETENTION_DAYS = 90;

export function recordEvent(
  db: Db,
  e: { type: InteractionEventType; channel: Channel; sessionId: string; searchId: string | null; storeId?: string | null; position?: number | null; sponsored?: boolean; dedupeKey?: string },
  now: Date = new Date(),
): boolean {
  const dedupeKey = e.dedupeKey ?? newId("ev");
  if (db.eventKeys.has(dedupeKey)) return false;
  db.eventKeys.add(dedupeKey);
  db.events.push({
    id: newId("ev"),
    dedupeKey,
    type: e.type,
    channel: e.channel,
    sessionId: e.sessionId,
    searchId: e.searchId,
    storeId: e.storeId ?? null,
    position: e.position ?? null,
    sponsored: e.sponsored ?? false,
    createdAt: now.toISOString(),
  });
  return true;
}

export function runSearch(
  input: { text: string; sessionId: string; channel: Channel; refinedFrom?: string | null },
  db: Db = getDb(),
  now: Date = new Date(),
): SearchOutcome {
  const searchId = newId("search");
  const base = { channel: input.channel, sessionId: input.sessionId, searchId };
  recordEvent(db, { ...base, type: "search_submitted" }, now);
  if (input.refinedFrom) recordEvent(db, { ...base, type: "search_refined" }, now);

  const parse = parseSearchText(input.text);
  recordEvent(db, { ...base, type: "search_parsed" }, now);
  const c = parse.conditions;

  const { results, totalCandidates } = rankStores(db.stores, c, now);
  const suggestions = buildSuggestions(db.stores, c, results.length, now);

  const pick = selectSponsored({
    campaigns: db.campaigns,
    stores: db.stores,
    conditions: c,
    organicStoreIds: results.map((r) => r.store.id),
    spentByCampaign: spentByCampaign(db),
    now,
  });

  let sponsored: SearchOutcome["sponsored"] = null;
  if (pick) {
    // 広告の「表示」イベント。課金はクリック時に別イベントとして記録する
    const impressionId = newId("imp");
    db.impressions.push({ id: impressionId, campaignId: pick.campaign.id, storeId: pick.store.id, searchId, sessionId: input.sessionId, createdAt: now.toISOString() });
    sponsored = {
      campaignId: pick.campaign.id,
      impressionId,
      store: pick.store,
      budgetText: formatBudget(pick.store, c.mealTime).text,
      matchReasons: pick.matchReasons,
    };
  }

  const budgetYen = c.budget?.max ?? c.budget?.target ?? c.budget?.min ?? null;
  db.searchLogs.push({
    id: searchId,
    sessionId: input.sessionId,
    channel: input.channel,
    rawText: input.text.slice(0, 200),
    conditions: c,
    budgetBand: budgetYen !== null ? budgetBandOf(budgetYen) : null,
    resultCount: results.length,
    shownStoreIds: results.map((r) => r.store.id),
    createdAt: now.toISOString(),
    synthetic: false,
  });

  if (results.length === 0) recordEvent(db, { ...base, type: "no_result" }, now);
  for (const r of results) {
    recordEvent(db, { ...base, type: "recommendation_shown", storeId: r.store.id, position: r.rank }, now);
  }
  if (sponsored) recordEvent(db, { ...base, type: "recommendation_shown", storeId: sponsored.store.id, position: 0, sponsored: true }, now);

  return { searchId, parse, results, sponsored, suggestions, totalCandidates };
}

/** 検索結果に実際に表示した店舗かどうか（クリック計測の水増し防止） */
export function wasShownInSearch(db: Db, searchId: string, storeId: string, sessionId: string): boolean {
  const log = db.searchLogs.find((l) => l.id === searchId);
  return !!log && log.sessionId === sessionId && log.shownStoreIds.includes(storeId);
}

/** 保存期間を過ぎた生の検索文を削除する（本番では日次バッチ） */
export function purgeExpiredRawText(db: Db, now: Date = new Date()): number {
  const limit = now.getTime() - RAW_TEXT_RETENTION_DAYS * 86_400_000;
  let purged = 0;
  for (const log of db.searchLogs) {
    if (log.rawText !== null && new Date(log.createdAt).getTime() < limit) {
      log.rawText = null;
      purged += 1;
    }
  }
  return purged;
}

/** 利用者からの削除依頼：そのセッションの検索文・行動ログを削除し、集計用ログは切り離す */
export function deleteConsumerData(db: Db, sessionId: string): { searches: number; events: number } {
  let searches = 0;
  // 本人とは結び付かない新しいIDに付け替える（1人を1人として数えるため、全ログで同じIDを使う）
  const detachedId = `deleted-${newId("s")}`;
  for (const log of db.searchLogs) {
    if (log.sessionId === sessionId) {
      log.rawText = null;
      log.sessionId = detachedId;
      searches += 1;
    }
  }
  const before = db.events.length;
  db.events = db.events.filter((e) => e.sessionId !== sessionId);
  return { searches, events: before - db.events.length };
}
