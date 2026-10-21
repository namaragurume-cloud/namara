import { describe, expect, it } from "vitest";

import { checkReply, generateReply } from "@/lib/ai/reply-generator";
import { DEMO_STORES } from "@/lib/demo/seed";
import type { Review } from "@/lib/types";

const store = DEMO_STORES[0];

function review(overrides: Partial<Review>): Review {
  return {
    id: "r1",
    storeId: store.id,
    googleReviewId: "g1",
    author: "たかはし",
    rating: 5,
    text: "上タン塩がおいしかったです。",
    createdAt: "2026-10-20T12:00:00+09:00",
    topics: [{ topic: "food", sentiment: "positive", keyword: "上タン塩" }],
    status: "unreplied",
    publishedReply: null,
    ...overrides,
  };
}

describe("返信案の生成（モック）", () => {
  it("口コミの具体的な内容に言及し、署名を付ける", () => {
    const text = generateReply({ review: review({}), store, policy: store.policy, tone: "friendly" });
    expect(text).toContain("上タン塩");
    expect(text.endsWith(store.policy.signature)).toBe(true);
  });

  it("投稿者名を使わない", () => {
    const text = generateReply({ review: review({}), store, policy: store.policy, tone: "polite" });
    expect(text).not.toContain("たかはし");
  });

  it("低評価ではお詫びを入れ、補償を約束しない", () => {
    const low = review({ rating: 1, text: "料理が出てくるまで30分ほどかかりました。", topics: [{ topic: "speed", sentiment: "negative" }] });
    for (const tone of ["polite", "friendly", "casual"] as const) {
      const text = generateReply({ review: low, store, policy: store.policy, tone });
      expect(text).toMatch(/申し訳/);
      expect(checkReply(text, store.policy, low.author).filter((c) => c.level === "error")).toEqual([]);
      expect(text).not.toMatch(/返金|無料|割引|必ず改善/);
    }
  });

  it("再生成（variant）で言い回しが変わる", () => {
    const a = generateReply({ review: review({}), store, policy: store.policy, tone: "polite", variant: 0 });
    const b = generateReply({ review: review({}), store, policy: store.policy, tone: "polite", variant: 1 });
    expect(a).not.toBe(b);
  });

  it("本文なしの口コミにも返信できる", () => {
    const text = generateReply({ review: review({ text: "", topics: [] }), store, policy: store.policy, tone: "casual" });
    expect(text.length).toBeGreaterThan(20);
  });
});

describe("返信文のチェック", () => {
  const policy = { ...store.policy, ngWords: ["激安"], maxLength: 50 };

  it("空・NGワードはエラー", () => {
    expect(checkReply("  ", policy)[0].level).toBe("error");
    expect(checkReply("激安でおいしい", policy).some((c) => c.level === "error")).toBe(true);
  });

  it("補償の約束・連絡先・投稿者名・文字数超過は警告", () => {
    const messages = checkReply("たかはし様、返金いたします。011-000-0001までご連絡ください。".padEnd(60, "。"), policy, "たかはし").map((c) => c.message);
    expect(messages.some((m) => m.includes("補償"))).toBe(true);
    expect(messages.some((m) => m.includes("電話番号"))).toBe(true);
    expect(messages.some((m) => m.includes("投稿者名"))).toBe(true);
    expect(messages.some((m) => m.includes("目安"))).toBe(true);
  });
});
