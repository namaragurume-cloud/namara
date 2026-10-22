import { describe, expect, it } from "vitest";
import { MIN_CELL_SESSIONS, MIN_TOTAL_SESSIONS, comparablePeriods, summarizeDemand } from "@/lib/analytics/aggregate";
import { emptyConditions } from "@/lib/search/parser";
import type { SearchLog } from "@/lib/shared/types";

const log = (sessionId: string, patch: Partial<SearchLog["conditions"]> = {}): SearchLog => ({
  id: `l-${Math.random()}`,
  sessionId,
  channel: "web",
  rawText: "生の入力文",
  conditions: { ...emptyConditions(), ...patch },
  budgetBand: null,
  resultCount: 3,
  shownStoreIds: [],
  createdAt: "2026-10-10T00:00:00Z",
  synthetic: false,
});

describe("匿名集計（少数セル抑制）", () => {
  it("全体のセッション数が少なければ「データ不足」", () => {
    const logs = Array.from({ length: MIN_TOTAL_SESSIONS - 1 }, (_, i) => log(`s${i}`, { areaIds: ["susukino"] }));
    const s = summarizeDemand(logs);
    expect(s.sufficient).toBe(false);
    expect(s.totalSearches).toBeNull();
    expect(s.byArea.cells).toEqual([]);
  });

  it("ユニークセッションが閾値未満の区分は件数を出さない", () => {
    const many = Array.from({ length: 40 }, (_, i) => log(`s${i}`, { areaIds: ["susukino"] }));
    // 1人が何度検索しても少数セルとして扱う
    const fewPeople = Array.from({ length: 30 }, () => log("heavy-user", { areaIds: ["otaru"] }));
    const s = summarizeDemand([...many, ...fewPeople]);
    const otaru = s.byArea.cells.find((c) => c.key === "otaru");
    expect(otaru).toEqual({ key: "otaru", label: "小樽", searches: null, suppressed: true });
    const susukino = s.byArea.cells.find((c) => c.key === "susukino");
    expect(susukino?.searches).toBe(40);
    // 抑制した区分のまとめ（その他）も、まとめて少数なら出さない
    expect(s.byArea.otherSearches).toBeNull();
  });

  it("件数は5単位に丸め、生の入力文やセッションIDを含まない", () => {
    const logs = Array.from({ length: 23 }, (_, i) => log(`s${i}`, { genreIds: ["ramen"] }));
    const s = summarizeDemand(logs);
    expect(s.byGenre.cells[0]?.searches).toBe(25);
    const json = JSON.stringify(s);
    expect(json).not.toContain("生の入力文");
    expect(json).not.toContain("s1");
    expect(MIN_CELL_SESSIONS).toBeGreaterThanOrEqual(5);
  });

  it("前月比較は同じ経過日数でそろえる", () => {
    const { current, previous } = comparablePeriods(new Date("2026-10-22T00:00:00Z"));
    expect(current.from.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(previous.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(previous.to.toISOString()).toBe("2026-09-22T00:00:00.000Z");
  });
});
