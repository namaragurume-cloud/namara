import { describe, expect, it } from "vitest";

import { buildSuggestions, computeKpis, monthKey, monthlyTrend, percentChange, ratingDistribution, shiftMonth } from "@/lib/analytics";
import { DEMO_TODAY } from "@/lib/constants";
import { createSeedData } from "@/lib/demo/seed";
import type { Review } from "@/lib/types";

const r = (createdAt: string, rating: Review["rating"], status: Review["status"] = "published"): Review => ({
  id: createdAt,
  storeId: "s",
  googleReviewId: createdAt,
  author: "a",
  rating,
  text: "",
  createdAt,
  topics: [],
  status,
  publishedReply: null,
});

describe("集計", () => {
  it("月キーはJSTで判定する", () => {
    expect(monthKey("2026-09-30T23:30:00+09:00")).toBe("2026-09");
    expect(monthKey("2026-09-30T15:30:00Z")).toBe("2026-10");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("今月件数は前月の同じ日付までと比較する", () => {
    const reviews = [
      r("2026-10-05T12:00:00+09:00", 5),
      r("2026-10-20T12:00:00+09:00", 4, "unreplied"),
      r("2026-09-10T12:00:00+09:00", 3),
      r("2026-09-25T12:00:00+09:00", 2),
    ];
    const k = computeKpis(reviews, DEMO_TODAY);
    expect(k.thisMonth).toBe(2);
    expect(k.prevMonthSamePeriod).toBe(1);
    expect(k.unreplied).toBe(1);
    expect(k.average).toBe(3.5);
    expect(k.averagePrevMonth).toBe(2.5);
  });

  it("前期が0件なら前期比は出さない", () => {
    expect(percentChange(5, 0)).toBeNull();
    expect(percentChange(15, 10)).toBe(50);
  });

  it("推移は12か月分を古い順に返す", () => {
    const trend = monthlyTrend([], DEMO_TODAY, 12);
    expect(trend).toHaveLength(12);
    expect(trend[0].key).toBe("2025-11");
    expect(trend[11].key).toBe("2026-10");
    expect(trend[0].average).toBeNull();
  });

  it("分布の割合の合計は100%", () => {
    const { reviews } = createSeedData();
    const total = ratingDistribution(reviews).reduce((sum, d) => sum + d.percent, 0);
    expect(total).toBeCloseTo(100);
  });

  it("サンプルデータから改善提案が作られる", () => {
    const { reviews } = createSeedData();
    const suggestions = buildSuggestions(reviews, DEMO_TODAY);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.severity === "info")).toBe(true);
  });
});

describe("サンプルデータ", () => {
  it("決定的に生成され、IDが重複しない", () => {
    const a = createSeedData();
    const b = createSeedData();
    expect(a.reviews.map((x) => x.id)).toEqual(b.reviews.map((x) => x.id));
    expect(new Set(a.reviews.map((x) => x.googleReviewId)).size).toBe(a.reviews.length);
    expect(a.reviews.every((x) => x.createdAt <= DEMO_TODAY)).toBe(true);
  });

  it("下書き・承認待ち・失敗の口コミには必ず返信案がある", () => {
    const { reviews, drafts } = createSeedData();
    for (const review of reviews.filter((x) => ["draft", "pending", "failed"].includes(x.status))) {
      expect(drafts[review.id]).toBeDefined();
    }
  });
});
