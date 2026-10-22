/**
 * モック用のインメモリ・データストア。
 *
 * 外部サービス（Supabase）に接続しなくても全画面を操作できるようにするためのものです。
 * - サーバー再起動でデモ操作の記録は消えます（合成データは毎回同じ内容で再生成）。
 * - 本番では supabase/migrations の同名テーブルに置き換えます（docs/DATABASE_SCHEMA.md）。
 * - サービス層（services/*.ts）以外から直接触らないこと。認可チェックはサービス層で行います。
 */
import "server-only";
import { DEMO_ORGANIZATIONS, SAMPLE_STORES } from "@/lib/data/sample-stores";
import { generateSyntheticReviews, generateSyntheticSearches } from "@/lib/data/synthetic";
import { selectSponsored } from "@/lib/ads/selector";
import { evaluateAdClick } from "@/lib/ads/billing";
import type {
  AdBillingEvent,
  AdClick,
  AdImpression,
  Campaign,
  InteractionEvent,
  Review,
  SearchLog,
  Store,
} from "@/lib/shared/types";
import { createRng } from "@/lib/shared/random";

export type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  createdAt: string;
};

export type Db = {
  createdAt: Date;
  stores: Store[];
  organizations: { id: string; name: string; plan: "free" | "starter" | "growth" | "pro" }[];
  searchLogs: SearchLog[];
  events: InteractionEvent[];
  eventKeys: Set<string>;
  campaigns: Campaign[];
  impressions: AdImpression[];
  clicks: AdClick[];
  billing: AdBillingEvent[];
  reviews: Review[];
  auditLogs: AuditLog[];
  /** LINE Webhook の重複受信防止（webhookEventId） */
  processedWebhookEvents: Set<string>;
};

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function demoCampaigns(stores: Store[], now: Date): Campaign[] {
  const start = isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  const end = isoDate(new Date(now.getTime() + 60 * 86_400_000));
  const make = (storeIndex: number, status: Campaign["status"], name: string): Campaign | null => {
    const store = stores[storeIndex];
    if (!store?.organizationId) return null;
    return {
      id: `camp-${store.id}`,
      storeId: store.id,
      organizationId: store.organizationId,
      name,
      targeting: { areaIds: [store.areaId], genreIds: [...store.genreIds] },
      startDate: start,
      endDate: end,
      status,
      budgetYen: 9800,
      cpcYen: 40,
      reviewNote: status === "approved" ? "審査OK（デモ）" : null,
      createdAt: `${start}T00:00:00.000Z`,
      updatedAt: `${start}T00:00:00.000Z`,
    };
  };
  return [
    make(0, "approved", "秋の検索スポンサー（デモ）"),
    make(1, "pending_review", "忘年会シーズン（デモ）"),
    make(2, "approved", "週末ランチ訴求（デモ）"),
  ].filter((c): c is Campaign => c !== null);
}

export function createDb(now: Date = new Date()): Db {
  const stores = SAMPLE_STORES.map((s) => structuredClone(s));
  const { logs, events: synEvents } = generateSyntheticSearches(stores, now);
  const campaigns = demoCampaigns(stores, now);

  const events: InteractionEvent[] = synEvents.map((e, i) => ({
    id: `syn-ev-${i}`,
    dedupeKey: `syn-ev-${i}`,
    type: e.type,
    channel: "web",
    sessionId: e.sessionId,
    searchId: e.searchId,
    storeId: e.storeId,
    position: e.position,
    sponsored: false,
    createdAt: e.createdAt,
  }));

  // 合成ログに対して広告配信をシミュレーション（選定ロジック・課金判定は本番と同じ関数を使う）
  const impressions: AdImpression[] = [];
  const clicks: AdClick[] = [];
  const billing: AdBillingEvent[] = [];
  const spent = new Map<string, number>();
  const rng = createRng(99);
  for (const log of logs) {
    const at = new Date(log.createdAt);
    const pick = selectSponsored({ campaigns, stores, conditions: log.conditions, organicStoreIds: log.shownStoreIds, spentByCampaign: spent, now: at });
    if (!pick) continue;
    const imp: AdImpression = { id: `syn-imp-${impressions.length}`, campaignId: pick.campaign.id, storeId: pick.store.id, searchId: log.id, sessionId: log.sessionId, createdAt: log.createdAt };
    impressions.push(imp);
    if (rng.next() < 0.06) {
      const decision = evaluateAdClick({ impression: imp, campaign: pick.campaign, sessionId: log.sessionId, priorClicks: clicks, spentYen: spent.get(pick.campaign.id) ?? 0, now: at });
      const click: AdClick = {
        id: `syn-click-${clicks.length}`,
        impressionId: imp.id,
        campaignId: pick.campaign.id,
        storeId: pick.store.id,
        sessionId: log.sessionId,
        createdAt: log.createdAt,
        valid: decision.valid,
        invalidReason: decision.valid ? null : decision.reason,
      };
      clicks.push(click);
      if (decision.valid) {
        billing.push({ id: `syn-bill-${billing.length}`, campaignId: pick.campaign.id, clickId: click.id, amountYen: decision.amountYen, createdAt: log.createdAt });
        spent.set(pick.campaign.id, (spent.get(pick.campaign.id) ?? 0) + decision.amountYen);
      }
    }
  }

  const orgStoreIds = stores.filter((s) => s.organizationId).map((s) => s.id);

  return {
    createdAt: now,
    stores,
    organizations: [
      ...DEMO_ORGANIZATIONS.map((o) => ({ id: o.id, name: o.name, plan: o.plan })),
    ],
    searchLogs: logs,
    events,
    eventKeys: new Set(events.map((e) => e.dedupeKey)),
    campaigns,
    impressions,
    clicks,
    billing,
    reviews: generateSyntheticReviews(orgStoreIds, now),
    auditLogs: [],
    processedWebhookEvents: new Set(),
  };
}

const globalForDb = globalThis as unknown as { __namaraDb?: Db };

/** 開発サーバーのホットリロードでも同じデータを使い続けるため globalThis に保持する */
export function getDb(): Db {
  if (!globalForDb.__namaraDb) globalForDb.__namaraDb = createDb();
  return globalForDb.__namaraDb;
}

/** テスト用：データを作り直す */
export function resetDb(now?: Date): Db {
  globalForDb.__namaraDb = createDb(now);
  return globalForDb.__namaraDb;
}

export function spentByCampaign(db: Db): Map<string, number> {
  const map = new Map<string, number>();
  for (const b of db.billing) map.set(b.campaignId, (map.get(b.campaignId) ?? 0) + b.amountYen);
  return map;
}

export function addAuditLog(db: Db, entry: Omit<AuditLog, "id" | "createdAt">): void {
  db.auditLogs.unshift({ ...entry, id: newId("audit"), createdAt: new Date().toISOString() });
}
