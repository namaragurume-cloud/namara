/**
 * 検索条件の辞書（エリア・ジャンル・利用シーン・希望条件）。
 * 自然文の解析と、店舗マスターの構造化データの両方がこの ID を使う。
 * 新しい言い回しに対応したいときは synonyms に追加する。
 */

export type City = "札幌市" | "小樽市" | "函館市" | "旭川市";

export type AreaDef = {
  id: string;
  label: string;
  city: City;
  /** 地図リンク用のエリア中心座標（架空店舗の位置はこの周辺の概略） */
  center: { lat: number; lng: number };
  synonyms: string[];
};

export const AREAS = [
  { id: "susukino", label: "すすきの", city: "札幌市", center: { lat: 43.0556, lng: 141.3536 }, synonyms: ["すすきの", "ススキノ", "薄野", "すすきの駅"] },
  { id: "odori", label: "大通", city: "札幌市", center: { lat: 43.0605, lng: 141.3545 }, synonyms: ["大通", "大通り", "大通公園", "大通駅"] },
  { id: "sapporo-station", label: "札幌駅", city: "札幌市", center: { lat: 43.0687, lng: 141.3508 }, synonyms: ["札幌駅", "さっぽろ駅", "札幌駅前"] },
  { id: "tanukikoji", label: "狸小路", city: "札幌市", center: { lat: 43.0577, lng: 141.3508 }, synonyms: ["狸小路", "たぬきこうじ"] },
  { id: "maruyama", label: "円山", city: "札幌市", center: { lat: 43.0546, lng: 141.3195 }, synonyms: ["円山", "まるやま", "円山公園", "裏参道"] },
  { id: "kotoni", label: "琴似", city: "札幌市", center: { lat: 43.0812, lng: 141.3065 }, synonyms: ["琴似", "ことに"] },
  { id: "shin-sapporo", label: "新札幌", city: "札幌市", center: { lat: 43.0386, lng: 141.4727 }, synonyms: ["新札幌", "しんさっぽろ"] },
  { id: "otaru", label: "小樽", city: "小樽市", center: { lat: 43.1907, lng: 140.9947 }, synonyms: ["小樽", "おたる", "小樽運河"] },
  { id: "hakodate", label: "函館", city: "函館市", center: { lat: 41.7738, lng: 140.7261 }, synonyms: ["函館", "はこだて", "函館駅", "ベイエリア"] },
  { id: "asahikawa", label: "旭川", city: "旭川市", center: { lat: 43.7631, lng: 142.3582 }, synonyms: ["旭川", "あさひかわ"] },
] as const satisfies readonly AreaDef[];

export type AreaId = (typeof AREAS)[number]["id"];

/** 「札幌」のような市区町村レベルの言い方 */
export const CITY_SYNONYMS: Record<City, string[]> = {
  札幌市: ["札幌市", "札幌", "さっぽろ"],
  小樽市: [],
  函館市: [],
  旭川市: [],
};

export type GenreDef = {
  id: string;
  label: string;
  synonyms: string[];
  /** 部分一致として扱うジャンル（例：寿司 → 海鮮） */
  related: string[];
};

export const GENRES = [
  { id: "yakiniku", label: "焼肉", synonyms: ["焼肉", "焼き肉", "やきにく", "ホルモン", "和牛"], related: ["jingisukan"] },
  { id: "jingisukan", label: "ジンギスカン", synonyms: ["ジンギスカン", "じんぎすかん", "ラム肉", "羊肉"], related: ["yakiniku"] },
  { id: "sushi", label: "寿司", synonyms: ["寿司", "すし", "鮨", "お寿司", "回転寿司"], related: ["kaisen", "washoku"] },
  { id: "kaisen", label: "海鮮", synonyms: ["海鮮", "魚介", "海鮮丼", "刺身", "カニ", "蟹", "かに", "ウニ", "うに", "いくら"], related: ["sushi", "washoku"] },
  { id: "ramen", label: "ラーメン", synonyms: ["ラーメン", "らーめん", "拉麺", "味噌ラーメン", "つけ麺"], related: [] },
  { id: "soup-curry", label: "スープカレー", synonyms: ["スープカレー", "スープカリー", "カレー"], related: [] },
  { id: "italian", label: "イタリアン", synonyms: ["イタリアン", "イタリア料理", "パスタ", "ピザ", "ピッツァ"], related: ["french", "bar"] },
  { id: "french", label: "フレンチ", synonyms: ["フレンチ", "フランス料理", "ビストロ"], related: ["italian"] },
  { id: "izakaya", label: "居酒屋", synonyms: ["居酒屋", "飲み屋", "大衆酒場"], related: ["yakitori", "kaisen"] },
  { id: "yakitori", label: "焼き鳥", synonyms: ["焼き鳥", "焼鳥", "やきとり"], related: ["izakaya"] },
  { id: "washoku", label: "和食", synonyms: ["和食", "日本料理", "割烹", "そば", "蕎麦", "うどん", "天ぷら"], related: ["sushi", "kaisen"] },
  { id: "chinese", label: "中華", synonyms: ["中華", "中華料理", "餃子", "ぎょうざ", "四川"], related: [] },
  { id: "cafe", label: "カフェ", synonyms: ["カフェ", "喫茶", "喫茶店", "コーヒー", "珈琲"], related: ["sweets"] },
  { id: "sweets", label: "スイーツ", synonyms: ["スイーツ", "パフェ", "ケーキ", "甘いもの", "デザート", "シメパフェ"], related: ["cafe"] },
  { id: "bar", label: "バー", synonyms: ["バー", "BAR", "ワインバー", "カクテル"], related: ["italian"] },
] as const satisfies readonly GenreDef[];

export type GenreId = (typeof GENRES)[number]["id"];

export const SCENES = [
  { id: "date", label: "デート", synonyms: ["デート", "カップル", "恋人", "彼女と", "彼氏と"] },
  { id: "anniversary", label: "記念日", synonyms: ["記念日", "誕生日", "お祝い", "プロポーズ"] },
  { id: "family", label: "家族", synonyms: ["家族", "ファミリー", "親と", "両親"] },
  { id: "business", label: "接待・会食", synonyms: ["接待", "会食", "ビジネス", "取引先", "商談"] },
  { id: "party", label: "宴会・飲み会", synonyms: ["宴会", "飲み会", "歓迎会", "送別会", "歓送迎会", "忘年会", "新年会", "打ち上げ"] },
  { id: "solo", label: "ひとり", synonyms: ["ひとり", "一人", "1人で", "おひとりさま", "おひとり様", "ソロ"] },
  { id: "girls", label: "女子会", synonyms: ["女子会", "ママ友"] },
  { id: "tourist", label: "観光", synonyms: ["観光", "旅行", "出張", "お土産"] },
  { id: "lunch", label: "ランチ", synonyms: ["ランチ", "昼ごはん", "昼ご飯", "お昼", "昼食"] },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

/** 希望条件。features はハード条件（指定されたら必ず満たす店だけを出す） */
export const FEATURES = [
  { id: "private_room", label: "個室あり", synonyms: ["個室", "半個室", "完全個室"] },
  { id: "non_smoking", label: "禁煙", synonyms: ["禁煙", "全席禁煙", "たばこNG", "タバコNG"] },
  { id: "kids_friendly", label: "子連れOK", synonyms: ["子連れ", "子ども連れ", "子供連れ", "キッズ", "赤ちゃん", "ベビーカー", "子ども", "子供"] },
  { id: "parking", label: "駐車場あり", synonyms: ["駐車場", "車で", "パーキング"] },
  { id: "late_night", label: "深夜営業", synonyms: ["深夜", "遅くまで", "朝まで", "終電後"] },
  { id: "counter", label: "カウンター席", synonyms: ["カウンター"] },
  { id: "all_you_can_drink", label: "飲み放題", synonyms: ["飲み放題", "のみほ"] },
  { id: "takeout", label: "テイクアウト", synonyms: ["テイクアウト", "持ち帰り", "お持ち帰り"] },
] as const;

export type FeatureId = (typeof FEATURES)[number]["id"];

/** 予算帯（需要分析の集計単位）。1人あたりの円 */
export const BUDGET_BANDS = [
  { id: "under-1000", label: "〜1,000円", min: 0, max: 1000 },
  { id: "1000-2000", label: "1,000〜2,000円", min: 1001, max: 2000 },
  { id: "2000-4000", label: "2,000〜4,000円", min: 2001, max: 4000 },
  { id: "4000-7000", label: "4,000〜7,000円", min: 4001, max: 7000 },
  { id: "7000-10000", label: "7,000〜10,000円", min: 7001, max: 10000 },
  { id: "over-10000", label: "10,000円〜", min: 10001, max: Number.POSITIVE_INFINITY },
] as const;

export type BudgetBandId = (typeof BUDGET_BANDS)[number]["id"];

const byId = <T extends { id: string; label: string }>(list: readonly T[]) =>
  new Map<string, T>(list.map((item) => [item.id, item]));

const areaMap = byId(AREAS);
const genreMap = byId(GENRES);
const sceneMap = byId(SCENES);
const featureMap = byId(FEATURES);
const bandMap = byId(BUDGET_BANDS);

export const areaLabel = (id: string) => areaMap.get(id)?.label ?? id;
export const genreLabel = (id: string) => genreMap.get(id)?.label ?? id;
export const sceneLabel = (id: string) => sceneMap.get(id)?.label ?? id;
export const featureLabel = (id: string) => featureMap.get(id)?.label ?? id;
export const budgetBandLabel = (id: string) => bandMap.get(id)?.label ?? id;
export const getArea = (id: string) => areaMap.get(id) as AreaDef | undefined;
export const getGenre = (id: string) => genreMap.get(id) as GenreDef | undefined;

export function budgetBandOf(yen: number): BudgetBandId {
  const band = BUDGET_BANDS.find((b) => yen >= b.min && yen <= b.max);
  return band?.id ?? "over-10000";
}
