/**
 * 広告クリックの有効判定と課金計算（モック）。
 *
 * 表示（ad_impressions）・クリック（ad_clicks）・課金（ad_billing_events）は別々に記録する。
 * 実際の請求・決済は Phase 10 まで実行しない。
 */
import type { AdClick, AdImpression, Campaign } from "@/lib/shared/types";
import { remainingBudget } from "./selector";

/** 同じセッションの同じ広告への再クリックは30分間は課金しない */
export const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;
/** 表示から24時間を過ぎたクリックは無効 */
export const IMPRESSION_TTL_MS = 24 * 60 * 60 * 1000;
/** 1セッションあたり1時間に課金対象とするクリックの上限 */
export const MAX_BILLABLE_CLICKS_PER_SESSION_HOUR = 5;

export type ClickDecision = { valid: true; amountYen: number } | { valid: false; reason: NonNullable<AdClick["invalidReason"]> };

export function evaluateAdClick(params: {
  impression: AdImpression | undefined;
  campaign: Campaign | undefined;
  sessionId: string;
  priorClicks: readonly AdClick[];
  spentYen: number;
  now: Date;
}): ClickDecision {
  const { impression, campaign, sessionId, priorClicks, spentYen, now } = params;
  if (!impression || !campaign) return { valid: false, reason: "unknown_impression" };
  if (impression.sessionId !== sessionId) return { valid: false, reason: "unknown_impression" };
  if (now.getTime() - new Date(impression.createdAt).getTime() > IMPRESSION_TTL_MS) return { valid: false, reason: "expired_impression" };

  const sessionValid = priorClicks.filter((c) => c.sessionId === sessionId && c.valid);
  const duplicate = sessionValid.some(
    (c) => c.campaignId === campaign.id && now.getTime() - new Date(c.createdAt).getTime() < DUPLICATE_WINDOW_MS,
  );
  if (duplicate) return { valid: false, reason: "duplicate" };

  const lastHour = sessionValid.filter((c) => now.getTime() - new Date(c.createdAt).getTime() < 60 * 60 * 1000);
  if (lastHour.length >= MAX_BILLABLE_CLICKS_PER_SESSION_HOUR) return { valid: false, reason: "rate_limited" };

  if (remainingBudget(campaign, spentYen) < campaign.cpcYen) return { valid: false, reason: "budget_exhausted" };
  return { valid: true, amountYen: campaign.cpcYen };
}
