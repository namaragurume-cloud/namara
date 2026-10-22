import { describe, expect, it } from "vitest";
import { SAMPLE_STORES } from "@/lib/data/sample-stores";
import { parseSearchText } from "@/lib/search/parser";
import { rankStores } from "@/lib/search/ranking";
import { selectSponsored } from "@/lib/ads/selector";
import { evaluateAdClick } from "@/lib/ads/billing";
import type { AdClick, AdImpression, Campaign, Store } from "@/lib/shared/types";

const NOW = new Date("2026-10-22T03:00:00Z");
const target = SAMPLE_STORES.find((s) => s.published && s.verification.status === "verified" && s.areaId === "susukino" && s.genreIds[0] === "yakiniku" && s.budget.dinner) as Store;

const campaign = (overrides: Partial<Campaign> = {}): Campaign => ({
  id: "camp-test",
  storeId: target.id,
  organizationId: "org-test",
  name: "test",
  targeting: { areaIds: ["susukino"], genreIds: ["yakiniku"] },
  startDate: "2026-10-01",
  endDate: "2026-12-31",
  status: "approved",
  budgetYen: 9800,
  cpcYen: 40,
  reviewNote: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  ...overrides,
});

const select = (text: string, camps: Campaign[], organic: string[] = [], spent = new Map<string, number>()) =>
  selectSponsored({ campaigns: camps, stores: SAMPLE_STORES, conditions: parseSearchText(text).conditions, organicStoreIds: organic, spentByCampaign: spent, now: NOW });

describe("スポンサー枠の選定", () => {
  it("検索条件とターゲティングが合えば1件だけ選ぶ", () => {
    expect(target).toBeDefined();
    const pick = select("すすきの 焼肉", [campaign()]);
    expect(pick?.store.id).toBe(target.id);
  });

  it("エリア・ジャンルが合わない検索には出さない", () => {
    expect(select("函館 寿司", [campaign()])).toBeNull();
    expect(select("すすきの ラーメン", [campaign()])).toBeNull();
  });

  it("エリアもジャンルも無い曖昧な検索には出さない", () => {
    expect(select("デート", [campaign()])).toBeNull();
  });

  it("審査前・停止・期間外・予算切れの広告は出さない", () => {
    for (const status of ["pending_review", "rejected", "paused", "stopped", "budget_exhausted", "draft"] as const) {
      expect(select("すすきの 焼肉", [campaign({ status })])).toBeNull();
    }
    expect(select("すすきの 焼肉", [campaign({ endDate: "2026-10-01" })])).toBeNull();
    expect(select("すすきの 焼肉", [campaign()], [], new Map([["camp-test", 9790]]))).toBeNull();
  });

  it("通常検索の結果に既に出ている店舗は広告枠に重複させない", () => {
    expect(select("すすきの 焼肉", [campaign()], [target.id])).toBeNull();
  });

  it("広告は通常検索の順位に影響しない", () => {
    const c = parseSearchText("すすきの 焼肉").conditions;
    const before = rankStores(SAMPLE_STORES, c, NOW).results.map((r) => r.store.id);
    select("すすきの 焼肉", [campaign({ budgetYen: 1_000_000 })]);
    const after = rankStores(SAMPLE_STORES, c, NOW).results.map((r) => r.store.id);
    expect(after).toEqual(before);
  });

  it("予算条件に合わない店舗の広告は出さない", () => {
    expect(select("すすきの 焼肉 1000円以内", [campaign()])).toBeNull();
  });
});

describe("広告クリックの課金判定", () => {
  const imp: AdImpression = { id: "imp-1", campaignId: "camp-test", storeId: target.id, searchId: "s1", sessionId: "web:a", createdAt: "2026-10-22T02:59:00Z" };
  const click = (overrides: Partial<AdClick>): AdClick => ({ id: "c", impressionId: "imp-1", campaignId: "camp-test", storeId: target.id, sessionId: "web:a", createdAt: "2026-10-22T02:59:30Z", valid: true, invalidReason: null, ...overrides });

  it("正しい表示からのクリックは課金対象", () => {
    expect(evaluateAdClick({ impression: imp, campaign: campaign(), sessionId: "web:a", priorClicks: [], spentYen: 0, now: NOW })).toEqual({ valid: true, amountYen: 40 });
  });
  it("存在しない表示・別セッションのクリックは無効", () => {
    expect(evaluateAdClick({ impression: undefined, campaign: campaign(), sessionId: "web:a", priorClicks: [], spentYen: 0, now: NOW }).valid).toBe(false);
    expect(evaluateAdClick({ impression: imp, campaign: campaign(), sessionId: "web:b", priorClicks: [], spentYen: 0, now: NOW }).valid).toBe(false);
  });
  it("30分以内の重複クリックは課金しない", () => {
    expect(evaluateAdClick({ impression: imp, campaign: campaign(), sessionId: "web:a", priorClicks: [click({})], spentYen: 40, now: NOW })).toEqual({ valid: false, reason: "duplicate" });
  });
  it("予算残高が足りなければ課金しない（予算超過防止）", () => {
    expect(evaluateAdClick({ impression: imp, campaign: campaign(), sessionId: "web:a", priorClicks: [], spentYen: 9780, now: NOW })).toEqual({ valid: false, reason: "budget_exhausted" });
  });
  it("期限切れの表示からのクリックは無効", () => {
    const old = { ...imp, createdAt: "2026-10-20T00:00:00Z" };
    expect(evaluateAdClick({ impression: old, campaign: campaign(), sessionId: "web:a", priorClicks: [], spentYen: 0, now: NOW })).toEqual({ valid: false, reason: "expired_impression" });
  });
});
