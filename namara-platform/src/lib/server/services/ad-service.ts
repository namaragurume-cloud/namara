/**
 * 広告キャンペーンの管理（モック：決済・請求は実行しない）。
 * すべての変更操作は監査ログに記録する。
 */
import "server-only";
import { z } from "zod";
import { AREAS, GENRES } from "@/lib/shared/dictionaries";
import type { AdClick, Campaign } from "@/lib/shared/types";
import { evaluateAdClick } from "@/lib/ads/billing";
import { addAuditLog, getDb, newId, spentByCampaign, type Db } from "../db";
import { actorId, assertOperator, assertStoreAccess, assertStoreManager, ForbiddenError, type Actor } from "../authz";

export type CampaignStats = {
  campaign: Campaign;
  storeName: string;
  impressions: number;
  clicks: number;
  invalidClicks: number;
  ctr: number | null;
  spentYen: number;
  remainingYen: number;
};

function statsFor(db: Db, campaign: Campaign, spent: Map<string, number>): CampaignStats {
  const impressions = db.impressions.filter((i) => i.campaignId === campaign.id).length;
  const clicks = db.clicks.filter((c) => c.campaignId === campaign.id);
  const valid = clicks.filter((c) => c.valid).length;
  const spentYen = spent.get(campaign.id) ?? 0;
  return {
    campaign,
    storeName: db.stores.find((s) => s.id === campaign.storeId)?.name ?? campaign.storeId,
    impressions,
    clicks: valid,
    invalidClicks: clicks.length - valid,
    ctr: impressions > 0 ? Math.round((valid / impressions) * 1000) / 10 : null,
    spentYen,
    remainingYen: Math.max(0, campaign.budgetYen - spentYen),
  };
}

export function listStoreCampaigns(actor: Actor, storeId: string, db: Db = getDb()): CampaignStats[] {
  assertStoreAccess(actor, storeId);
  const spent = spentByCampaign(db);
  return db.campaigns.filter((c) => c.storeId === storeId).map((c) => statsFor(db, c, spent));
}

export function listAllCampaigns(actor: Actor, db: Db = getDb()): CampaignStats[] {
  assertOperator(actor);
  const spent = spentByCampaign(db);
  return db.campaigns.map((c) => statsFor(db, c, spent));
}

const areaIds = AREAS.map((a) => a.id) as [string, ...string[]];
const genreIds = GENRES.map((g) => g.id) as [string, ...string[]];
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付の形式が正しくありません");

export const campaignInputSchema = z
  .object({
    storeId: z.string().min(1),
    name: z.string().trim().min(1, "キャンペーン名を入力してください").max(60),
    areaIds: z.array(z.enum(areaIds)).min(1, "対象エリアを1つ以上選んでください").max(5).transform((v) => [...new Set(v)]),
    genreIds: z.array(z.enum(genreIds)).min(1, "対象ジャンルを1つ以上選んでください").max(5).transform((v) => [...new Set(v)]),
    startDate: dateSchema,
    endDate: dateSchema,
    budgetYen: z.coerce.number().int().min(9800, "予算は9,800円以上で設定してください").max(1_000_000),
  })
  .refine((v) => v.startDate <= v.endDate, { message: "終了日は開始日以降にしてください", path: ["endDate"] });

export type CampaignInput = z.infer<typeof campaignInputSchema>;

/** 店舗オーナーが作成 → 必ず「審査待ち」から始まる（自分で承認はできない） */
export function createCampaign(actor: Actor, raw: unknown, db: Db = getDb(), now: Date = new Date()): Campaign {
  const input = campaignInputSchema.parse(raw);
  assertStoreManager(actor, input.storeId);
  const store = db.stores.find((s) => s.id === input.storeId);
  if (!store || !store.organizationId) throw new ForbiddenError("契約店舗のみ広告を作成できます");
  const campaign: Campaign = {
    id: newId("camp"),
    storeId: store.id,
    organizationId: store.organizationId,
    name: input.name,
    targeting: { areaIds: input.areaIds as Campaign["targeting"]["areaIds"], genreIds: input.genreIds as Campaign["targeting"]["genreIds"] },
    startDate: input.startDate,
    endDate: input.endDate,
    status: "pending_review",
    budgetYen: input.budgetYen,
    cpcYen: 40,
    reviewNote: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  db.campaigns.push(campaign);
  addAuditLog(db, { actorId: actorId(actor), action: "campaign.create", targetType: "campaign", targetId: campaign.id, detail: `予算${input.budgetYen}円` });
  return campaign;
}

function findCampaign(db: Db, id: string): Campaign {
  const campaign = db.campaigns.find((c) => c.id === id);
  if (!campaign) throw new ForbiddenError("キャンペーンが見つかりません");
  return campaign;
}

/** 店舗側の配信停止 */
export function stopCampaignByStore(actor: Actor, campaignId: string, db: Db = getDb(), now: Date = new Date()): Campaign {
  const campaign = findCampaign(db, campaignId);
  assertStoreManager(actor, campaign.storeId);
  campaign.status = "stopped";
  campaign.updatedAt = now.toISOString();
  addAuditLog(db, { actorId: actorId(actor), action: "campaign.stop_by_store", targetType: "campaign", targetId: campaign.id, detail: "" });
  return campaign;
}

/** 運営の審査・停止 */
export function reviewCampaign(
  actor: Actor,
  campaignId: string,
  decision: "approve" | "reject" | "stop",
  note: string,
  db: Db = getDb(),
  now: Date = new Date(),
): Campaign {
  assertOperator(actor);
  const campaign = findCampaign(db, campaignId);
  if (decision === "approve" && campaign.status !== "pending_review" && campaign.status !== "paused") {
    throw new ForbiddenError("審査待ち・一時停止中のキャンペーンのみ承認できます");
  }
  campaign.status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "stopped";
  campaign.reviewNote = note.slice(0, 200) || null;
  campaign.updatedAt = now.toISOString();
  addAuditLog(db, { actorId: actorId(actor), action: `campaign.${decision}`, targetType: "campaign", targetId: campaign.id, detail: note.slice(0, 200) });
  return campaign;
}

/**
 * 広告クリックの記録。表示IDが本物で、同じセッションから来たクリックだけを有効とし、
 * 有効なクリックだけ課金イベントを作る。予算を使い切ったら配信を止める。
 */
export function recordAdClick(
  input: { impressionId: string; sessionId: string },
  db: Db = getDb(),
  now: Date = new Date(),
): { click: AdClick; storeId: string | null } {
  const impression = db.impressions.find((i) => i.id === input.impressionId);
  const campaign = impression ? db.campaigns.find((c) => c.id === impression.campaignId) : undefined;
  const spent = campaign ? (spentByCampaign(db).get(campaign.id) ?? 0) : 0;
  const decision = evaluateAdClick({ impression, campaign, sessionId: input.sessionId, priorClicks: db.clicks, spentYen: spent, now });

  const click: AdClick = {
    id: newId("click"),
    impressionId: input.impressionId,
    campaignId: campaign?.id ?? "unknown",
    storeId: impression?.storeId ?? "unknown",
    sessionId: input.sessionId,
    createdAt: now.toISOString(),
    valid: decision.valid,
    invalidReason: decision.valid ? null : decision.reason,
  };
  db.clicks.push(click);

  if (decision.valid && campaign) {
    db.billing.push({ id: newId("bill"), campaignId: campaign.id, clickId: click.id, amountYen: decision.amountYen, createdAt: now.toISOString() });
    if (campaign.budgetYen - (spent + decision.amountYen) < campaign.cpcYen) {
      campaign.status = "budget_exhausted";
      campaign.updatedAt = now.toISOString();
      addAuditLog(db, { actorId: "system", action: "campaign.budget_exhausted", targetType: "campaign", targetId: campaign.id, detail: "予算上限に達したため自動停止" });
    }
  }
  return { click, storeId: impression?.storeId ?? null };
}
