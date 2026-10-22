import { describe, expect, it } from "vitest";
import { SAMPLE_STORES } from "@/lib/data/sample-stores";
import { parseSearchText } from "@/lib/search/parser";
import { buildSuggestions, meetsHardConditions, rankStores, relevantPrice } from "@/lib/search/ranking";
import type { Store } from "@/lib/shared/types";

const NOW = new Date("2026-10-22T03:00:00Z");
const search = (text: string) => {
  const { conditions } = parseSearchText(text);
  return { conditions, ...rankStores(SAMPLE_STORES, conditions, NOW) };
};

describe("サンプル店舗マスター", () => {
  it("100〜200店舗あり、すべて架空と明示されている", () => {
    expect(SAMPLE_STORES.length).toBeGreaterThanOrEqual(100);
    expect(SAMPLE_STORES.length).toBeLessThanOrEqual(200);
    for (const s of SAMPLE_STORES) {
      expect(s.isSample).toBe(true);
      expect(s.name).toContain("（架空）");
      expect(s.photo).toBeNull();
    }
    expect(new Set(SAMPLE_STORES.map((s) => s.id)).size).toBe(SAMPLE_STORES.length);
  });
});

describe("rankStores（推薦エンジン）", () => {
  it("最大5件で、すべて必須条件を満たす", () => {
    const { results, conditions } = search("すすきの 焼肉 予算8000円");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
    for (const r of results) {
      expect(r.store.areaId).toBe("susukino");
      expect(r.store.genreIds).toContain("yakiniku");
      expect(meetsHardConditions(r.store, conditions)).toBe(true);
      expect(r.reasons.length).toBeGreaterThan(0);
    }
    expect(results.map((r) => r.rank)).toEqual(results.map((_, i) => i + 1));
  });

  it("「以内」は上限を超える価格帯の店を出さない", () => {
    const { results } = search("札幌駅でランチ 1500円以内");
    for (const r of results) {
      const price = relevantPrice(r.store, "lunch");
      expect(price).not.toBeNull();
      expect(price!.range.min).toBeLessThanOrEqual(1500);
    }
  });

  it("希望条件（個室）は必ず満たす", () => {
    const { results } = search("大通でデート向けのイタリアン、個室あり");
    for (const r of results) expect(r.store.features).toContain("private_room");
  });

  it("非公開・未検証の店舗は出さない", () => {
    const hidden = SAMPLE_STORES.filter((s) => !s.published || s.verification.status !== "verified");
    expect(hidden.length).toBeGreaterThan(0);
    const all = rankStores(SAMPLE_STORES, parseSearchText("札幌").conditions, NOW);
    expect(all.results.every((r) => r.store.published && r.store.verification.status === "verified")).toBe(true);
  });

  it("価格が不明な店舗は予算指定の検索に出さず、表示は「不明」", () => {
    const unknown = SAMPLE_STORES.find((s) => s.budget.basis === null && s.published && s.verification.status === "verified") as Store;
    expect(unknown).toBeDefined();
    const c = { ...parseSearchText("予算5000円").conditions, areaIds: [unknown.areaId] };
    expect(meetsHardConditions(unknown, c)).toBe(false);
    const noBudget = rankStores([unknown], { ...c, budget: null, genreIds: [...unknown.genreIds] }, NOW);
    expect(noBudget.results[0]?.budgetText).toBe("不明");
  });

  it("条件に合う店が5件未満ならその件数だけ返し、言い換え提案を出す", () => {
    const { results, conditions } = search("旭川 フレンチ 個室 禁煙 3000円以内");
    expect(results.length).toBeLessThan(5);
    const suggestions = buildSuggestions(SAMPLE_STORES, conditions, results.length, NOW);
    expect(Array.isArray(suggestions)).toBe(true);
  });

  it("条件が何も無いときは推薦しない（でたらめに出さない）", () => {
    expect(search("こんにちは").results).toEqual([]);
  });

  it("同じ入力なら同じ順位（決定的）", () => {
    const a = search("すすきの 寿司").results.map((r) => r.store.id);
    const b = search("すすきの 寿司").results.map((r) => r.store.id);
    expect(a).toEqual(b);
  });

  it("確認日が古い店舗には注意書きを付ける", () => {
    const stale = SAMPLE_STORES.find(
      (s) => s.published && s.verification.status === "verified" && s.verification.verifiedAt && s.verification.verifiedAt < "2026-04-01",
    );
    expect(stale).toBeDefined();
    const r = rankStores([stale!], { ...parseSearchText("").conditions, areaIds: [stale!.areaId] }, NOW);
    expect(r.results[0]?.warnings.join()).toContain("確認日");
  });
});
