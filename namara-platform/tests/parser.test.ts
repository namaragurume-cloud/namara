import { describe, expect, it } from "vitest";
import { parseSearchText } from "@/lib/search/parser";

describe("parseSearchText（自然文から条件を抽出）", () => {
  it("すすきの 焼肉 予算8000円", () => {
    const { conditions: c } = parseSearchText("すすきの 焼肉 予算8000円");
    expect(c.areaIds).toEqual(["susukino"]);
    expect(c.genreIds).toEqual(["yakiniku"]);
    expect(c.budget).toEqual({ min: null, max: null, target: 8000, strict: false });
  });

  it("札幌駅でランチ 1500円以内", () => {
    const { conditions: c } = parseSearchText("札幌駅でランチ 1500円以内");
    expect(c.areaIds).toEqual(["sapporo-station"]);
    expect(c.cities).toEqual([]);
    expect(c.mealTime).toBe("lunch");
    expect(c.budget).toEqual({ min: null, max: 1500, target: null, strict: true });
  });

  it("大通でデート向けのイタリアン、個室あり", () => {
    const { conditions: c } = parseSearchText("大通でデート向けのイタリアン、個室あり");
    expect(c.areaIds).toEqual(["odori"]);
    expect(c.genreIds).toEqual(["italian"]);
    expect(c.scenes).toContain("date");
    expect(c.features).toEqual(["private_room"]);
  });

  it("子連れで行ける海鮮のお店", () => {
    const { conditions: c, notes } = parseSearchText("子連れで行ける海鮮のお店");
    expect(c.genreIds).toEqual(["kaisen"]);
    expect(c.features).toEqual(["kids_friendly"]);
    expect(c.areaIds).toEqual([]);
    expect(c.keywords).toEqual([]);
    expect(notes.join()).toContain("エリアの指定がない");
  });

  it("全角数字・万円・範囲指定・人数・日時を読み取る", () => {
    const { conditions: c } = parseSearchText("明日19時 ４人 新札幌 居酒屋 3000〜5000円");
    expect(c.areaIds).toEqual(["shin-sapporo"]);
    expect(c.cities).toEqual([]);
    expect(c.genreIds).toEqual(["izakaya"]);
    expect(c.partySize).toBe(4);
    expect(c.dateText).toBe("明日");
    expect(c.timeText).toBe("19:00");
    expect(c.mealTime).toBe("dinner");
    expect(c.budget).toEqual({ min: 3000, max: 5000, target: null, strict: true });
  });

  it("「1万円」「五千円まで」を円に変換する", () => {
    expect(parseSearchText("札幌 寿司 1万円くらい").conditions.budget?.target).toBe(10000);
    expect(parseSearchText("小樽 寿司 五千円まで").conditions.budget?.max).toBe(5000);
  });

  it("「札幌」は市レベルの指定として扱う", () => {
    const { conditions: c } = parseSearchText("札幌でスープカレー");
    expect(c.cities).toEqual(["札幌市"]);
    expect(c.genreIds).toEqual(["soup-curry"]);
  });

  it("夜景はキーワードとして残し、ディナー扱いにしない", () => {
    const { conditions: c } = parseSearchText("夜景がきれいなバー");
    expect(c.genreIds).toEqual(["bar"]);
    expect(c.keywords).toContain("夜景");
    expect(c.mealTime).toBeNull();
  });

  it("何も読み取れないときは案内を返す", () => {
    const r = parseSearchText("こんにちは");
    expect(r.notes[0]).toContain("条件を読み取れませんでした");
  });
});
