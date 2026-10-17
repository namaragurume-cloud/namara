import { describe, expect, it } from "vitest";
import { containsForbiddenWord, sanitizeAiDescription, templateDescription } from "@/lib/ai-copy";
import { suggestPrice } from "@/lib/price-suggest";

describe("AI 商品説明（テンプレート）", () => {
  it("BOX: 受取時間と残数を含み、禁止語を含まない", () => {
    const text = templateDescription({ name: "パンBOX", isBox: true, category: "bread", rescuePrice: 800, originalPrice: 1500, quantity: 5, pickupEnd: "20:00" });
    expect(text).toContain("本日限定の食べつなぎBOX。");
    expect(text).toContain("今日店頭に並んだパンを詰め合わせました。");
    expect(text).toContain("20:00までのお受け取り限定、残り5BOXです。");
    expect(containsForbiddenWord(text)).toBe(false);
  });

  it("単品・全カテゴリーで禁止語を含まない", () => {
    for (const category of ["bread", "bento", "deli", "sweets", "hotel", "other"]) {
      const text = templateDescription({ name: "日替わり弁当", isBox: false, category, rescuePrice: 450, quantity: 3, pickupEnd: "19:30" });
      expect(text).toContain("残り3点");
      expect(containsForbiddenWord(text)).toBe(false);
    }
  });

  it("AI 出力の禁止語・極端な長さは却下する", () => {
    expect(sanitizeAiDescription("フードロスをレスキュー！今日のパンを救おう。")).toBeNull();
    expect(sanitizeAiDescription("半額でお得なパンです。20時まで。残り5個。")).toBeNull();
    expect(sanitizeAiDescription("短い")).toBeNull();
    expect(sanitizeAiDescription("「本日限定の食べつなぎBOX。\n今日のパンを詰め合わせました。」")).toBe(
      "本日限定の食べつなぎBOX。\n今日のパンを詰め合わせました。",
    );
  });
});

describe("AI 値引き提案（ルールベース）", () => {
  const h = (reserved: number, minutes: number | null) => ({ rescuePrice: 800, originalPrice: 1500, listed: 5, reserved, minutesToSellOut: minutes });

  it("履歴が少ないときは提案しない", () => {
    expect(suggestPrice({ originalPrice: 1500, currentPrice: 800, history: [h(5, 30)] })).toBeNull();
  });

  it("早く完売し続けていれば少し上げる提案", () => {
    const s = suggestPrice({ originalPrice: 1500, currentPrice: 800, history: [h(5, 30), h(5, 40), h(5, 60), h(5, 20)] });
    expect(s?.direction).toBe("up");
    expect(s!.suggestedPrice).toBeGreaterThan(800);
    expect(s!.suggestedPrice).toBeLessThanOrEqual(1200);
  });

  it("売れ残りが多ければ少し下げる提案（下限は通常価格の30%）", () => {
    const s = suggestPrice({ originalPrice: 1500, currentPrice: 800, history: [h(1, null), h(2, null), h(1, null)] });
    expect(s?.direction).toBe("down");
    expect(s!.suggestedPrice).toBeLessThan(800);
    expect(s!.suggestedPrice).toBeGreaterThanOrEqual(450);
  });
});
