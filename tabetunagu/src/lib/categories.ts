export const CATEGORIES = [
  { id: "bread", label: "パン", weightG: 300 },
  { id: "bento", label: "弁当", weightG: 450 },
  { id: "deli", label: "惣菜", weightG: 350 },
  { id: "sweets", label: "スイーツ", weightG: 200 },
  { id: "hotel", label: "ホテル", weightG: 500 },
  { id: "other", label: "その他", weightG: 300 },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "その他";
}

/** 1点あたりの推定重量（食品ロス削減量の簡易計算用） */
export function estimatedWeightG(id: string, isBox: boolean) {
  const base = CATEGORIES.find((c) => c.id === id)?.weightG ?? 300;
  return isBox ? Math.round(base * 1.5) : base;
}

export const AREAS = [
  { id: "sapporo-station", label: "札幌駅" },
  { id: "odori", label: "大通" },
  { id: "susukino", label: "すすきの" },
  { id: "other", label: "その他" },
] as const;

export type AreaId = (typeof AREAS)[number]["id"];
export const AREA_IDS = AREAS.map((a) => a.id) as [AreaId, ...AreaId[]];

export function areaLabel(id: string) {
  return AREAS.find((a) => a.id === id)?.label ?? "その他";
}

/** 位置情報を使わない「近い順」: エリアの並び順の距離で近似する */
export function areaDistance(from: string, to: string) {
  const a = AREAS.findIndex((x) => x.id === from);
  const b = AREAS.findIndex((x) => x.id === to);
  if (a < 0 || b < 0) return 9;
  return Math.abs(a - b);
}
