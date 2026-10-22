/**
 * 店舗向け「検索需要」の匿名集計。
 *
 * 再識別リスク対策：
 * - 少数セル抑制：ユニークセッション数が MIN_CELL_SESSIONS 未満の区分は件数を出さない
 * - 丸め：店舗向けの件数は ROUND_TO 単位に丸める（差分から少数セルを逆算されにくくする）
 * - 抑制した区分は「その他（少数）」にまとめ、まとめても少数ならそれも出さない
 * - 生の入力文・セッションIDは店舗向けには一切返さない
 *
 * 検索回数は「来店数」ではない。画面にも必ずその旨を表示する。
 */
import {
  AREAS,
  BUDGET_BANDS,
  FEATURES,
  GENRES,
  SCENES,
  areaLabel,
  genreLabel,
  type AreaId,
} from "@/lib/shared/dictionaries";
import type { SearchLog } from "@/lib/shared/types";

export const MIN_CELL_SESSIONS = 5;
export const MIN_TOTAL_SESSIONS = 20;
export const ROUND_TO = 5;

export type DemandCell = {
  key: string;
  label: string;
  /** 丸めた検索回数。抑制された場合は null */
  searches: number | null;
  suppressed: boolean;
};

export type DemandBreakdown = { cells: DemandCell[]; otherSearches: number | null };

export type DemandSummary = {
  sufficient: boolean;
  totalSearches: number | null;
  byArea: DemandBreakdown;
  byGenre: DemandBreakdown;
  byBudget: DemandBreakdown;
  byScene: DemandBreakdown;
  byFeature: DemandBreakdown;
  synthetic: boolean;
};

export const roundCount = (n: number) => Math.round(n / ROUND_TO) * ROUND_TO;

type Period = { from: Date; to: Date };

export function filterLogs(logs: readonly SearchLog[], period: Period, areaFilter?: readonly AreaId[]): SearchLog[] {
  const from = period.from.getTime();
  const to = period.to.getTime();
  return logs.filter((log) => {
    const t = new Date(log.createdAt).getTime();
    if (t < from || t >= to) return false;
    if (areaFilter && areaFilter.length > 0) return log.conditions.areaIds.some((a) => areaFilter.includes(a));
    return true;
  });
}

function breakdown(
  logs: readonly SearchLog[],
  keysOf: (log: SearchLog) => readonly string[],
  labels: readonly { id: string; label: string }[],
): DemandBreakdown {
  const searches = new Map<string, number>();
  const sessions = new Map<string, Set<string>>();
  for (const log of logs) {
    for (const key of new Set(keysOf(log))) {
      searches.set(key, (searches.get(key) ?? 0) + 1);
      const set = sessions.get(key) ?? new Set<string>();
      set.add(log.sessionId);
      sessions.set(key, set);
    }
  }

  const cells: DemandCell[] = [];
  let otherSearches = 0;
  const otherSessions = new Set<string>();
  for (const { id, label } of labels) {
    const count = searches.get(id) ?? 0;
    if (count === 0) continue;
    const sessionSet = sessions.get(id) ?? new Set<string>();
    if (sessionSet.size < MIN_CELL_SESSIONS) {
      otherSearches += count;
      sessionSet.forEach((s) => otherSessions.add(s));
      cells.push({ key: id, label, searches: null, suppressed: true });
    } else {
      cells.push({ key: id, label, searches: roundCount(count), suppressed: false });
    }
  }
  cells.sort((a, b) => (b.searches ?? -1) - (a.searches ?? -1));
  return {
    cells,
    otherSearches: otherSearches > 0 && otherSessions.size >= MIN_CELL_SESSIONS ? roundCount(otherSearches) : null,
  };
}

export function summarizeDemand(logs: readonly SearchLog[]): DemandSummary {
  const sessions = new Set(logs.map((l) => l.sessionId));
  const sufficient = sessions.size >= MIN_TOTAL_SESSIONS;
  const empty: DemandBreakdown = { cells: [], otherSearches: null };
  if (!sufficient) {
    return { sufficient, totalSearches: null, byArea: empty, byGenre: empty, byBudget: empty, byScene: empty, byFeature: empty, synthetic: logs.some((l) => l.synthetic) };
  }
  return {
    sufficient,
    totalSearches: roundCount(logs.length),
    byArea: breakdown(logs, (l) => l.conditions.areaIds, AREAS),
    byGenre: breakdown(logs, (l) => l.conditions.genreIds, GENRES),
    byBudget: breakdown(logs, (l) => (l.budgetBand ? [l.budgetBand] : []), BUDGET_BANDS),
    byScene: breakdown(logs, (l) => l.conditions.scenes, SCENES),
    byFeature: breakdown(logs, (l) => l.conditions.features, FEATURES),
    synthetic: logs.some((l) => l.synthetic),
  };
}

export type MonthComparison = {
  key: string;
  label: string;
  current: number | null;
  previous: number | null;
  /** 前月比（%）。どちらかが抑制・0件なら null */
  changePct: number | null;
};

export function compareBreakdowns(current: DemandBreakdown, previous: DemandBreakdown): MonthComparison[] {
  const prev = new Map(previous.cells.map((c) => [c.key, c]));
  return current.cells.map((cell) => {
    const p = prev.get(cell.key);
    const prevCount = p && !p.suppressed ? p.searches : null;
    const changePct =
      cell.searches !== null && prevCount !== null && prevCount > 0 ? Math.round(((cell.searches - prevCount) / prevCount) * 100) : null;
    return { key: cell.key, label: cell.label, current: cell.searches, previous: prevCount, changePct };
  });
}

export type UnderservedTheme = { label: string; searches: number; avgResults: number };

/** 検索はあるのに条件に合う店が少ない「エリア×ジャンル」の組み合わせ */
export function findUnderservedThemes(logs: readonly SearchLog[], maxAvgResults = 3): UnderservedTheme[] {
  const groups = new Map<string, { searches: number; results: number; sessions: Set<string>; label: string }>();
  for (const log of logs) {
    for (const area of log.conditions.areaIds) {
      for (const genre of log.conditions.genreIds) {
        const key = `${area}:${genre}`;
        const g = groups.get(key) ?? { searches: 0, results: 0, sessions: new Set<string>(), label: `${areaLabel(area)} × ${genreLabel(genre)}` };
        g.searches += 1;
        g.results += log.resultCount;
        g.sessions.add(log.sessionId);
        groups.set(key, g);
      }
    }
  }
  return [...groups.values()]
    .filter((g) => g.sessions.size >= MIN_CELL_SESSIONS)
    .map((g) => ({ label: g.label, searches: roundCount(g.searches), avgResults: Math.round((g.results / g.searches) * 10) / 10 }))
    .filter((g) => g.avgResults < maxAvgResults)
    .sort((a, b) => b.searches - a.searches)
    .slice(0, 5);
}

export function monthRange(now: Date, offset = 0): Period {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  return { from, to };
}

/** 同じ経過日数で比較する（今月1〜21日 vs 前月1〜21日） */
export function comparablePeriods(now: Date): { current: Period; previous: Period } {
  const current = { from: monthRange(now).from, to: now };
  const prevFrom = monthRange(now, -1).from;
  const elapsed = now.getTime() - current.from.getTime();
  const prevTo = new Date(Math.min(prevFrom.getTime() + elapsed, monthRange(now).from.getTime()));
  return { current, previous: { from: prevFrom, to: prevTo } };
}
