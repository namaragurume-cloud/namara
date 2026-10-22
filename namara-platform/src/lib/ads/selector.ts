/**
 * スポンサー枠（最大1件）の選定ロジック。
 *
 * - 通常検索（最大5件）とは完全に別枠。通常順位は広告費で変わらない。
 * - 検索条件の必須条件を満たさない店舗の広告は出さない。
 * - エリアもジャンルも指定されていない検索では、ターゲティングの根拠が無いため広告を出さない。
 */
import { areaLabel, genreLabel } from "@/lib/shared/dictionaries";
import type { Campaign, SearchConditions, Store } from "@/lib/shared/types";
import { meetsHardConditions, scoreStore } from "@/lib/search/ranking";

export type SponsoredCandidate = { campaign: Campaign; store: Store; matchReasons: string[] };

export type SelectSponsoredInput = {
  campaigns: readonly Campaign[];
  stores: readonly Store[];
  conditions: SearchConditions;
  organicStoreIds: readonly string[];
  spentByCampaign: ReadonlyMap<string, number>;
  now: Date;
};

const today = (now: Date) => now.toISOString().slice(0, 10);

export function remainingBudget(campaign: Campaign, spent: number): number {
  return Math.max(0, campaign.budgetYen - spent);
}

/** 配信可能な状態か（審査・期間・予算） */
export function isCampaignServable(campaign: Campaign, spent: number, now: Date): boolean {
  const d = today(now);
  return (
    campaign.status === "approved" &&
    campaign.startDate <= d &&
    d <= campaign.endDate &&
    remainingBudget(campaign, spent) >= campaign.cpcYen
  );
}

export function selectSponsored(input: SelectSponsoredInput): SponsoredCandidate | null {
  const { conditions: c, now } = input;
  if (c.areaIds.length === 0 && c.genreIds.length === 0) return null;

  const storeById = new Map(input.stores.map((s) => [s.id, s]));
  const candidates: (SponsoredCandidate & { score: number; spentRatio: number })[] = [];

  for (const campaign of input.campaigns) {
    const spent = input.spentByCampaign.get(campaign.id) ?? 0;
    if (!isCampaignServable(campaign, spent, now)) continue;
    const store = storeById.get(campaign.storeId);
    if (!store || input.organicStoreIds.includes(store.id)) continue;
    if (!meetsHardConditions(store, c)) continue;

    const matchReasons: string[] = [];
    if (c.areaIds.length > 0) {
      const area = campaign.targeting.areaIds.find((a) => c.areaIds.includes(a));
      if (!area) continue;
      matchReasons.push(`エリア「${areaLabel(area)}」の検索`);
    }
    if (c.genreIds.length > 0) {
      const genre = campaign.targeting.genreIds.find((g) => c.genreIds.includes(g));
      if (!genre) continue;
      matchReasons.push(`ジャンル「${genreLabel(genre)}」の検索`);
    }
    if (c.budget) matchReasons.push("ご希望の予算に合う目安");

    const { score } = scoreStore(store, c, now);
    candidates.push({ campaign, store, matchReasons, score, spentRatio: spent / campaign.budgetYen });
  }

  candidates.sort((a, b) => b.score - a.score || a.spentRatio - b.spentRatio || a.campaign.id.localeCompare(b.campaign.id));
  const best = candidates[0];
  return best ? { campaign: best.campaign, store: best.store, matchReasons: best.matchReasons } : null;
}
