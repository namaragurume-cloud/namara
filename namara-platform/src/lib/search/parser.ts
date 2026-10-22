/**
 * 自然文の検索条件パーサー（辞書＋ルール方式）。
 *
 * 外部APIを使わずに動くモック実装です。将来 OpenAI で解析する場合も、
 * 出力はこのファイルの normalizeConditions() を通して同じ形にそろえます。
 * AI は「条件の抽出」だけを担当し、店舗の選定は ranking.ts が構造化データで行います。
 */
import {
  AREAS,
  CITY_SYNONYMS,
  FEATURES,
  GENRES,
  SCENES,
  type AreaId,
  type City,
  type FeatureId,
  type GenreId,
  type SceneId,
} from "@/lib/shared/dictionaries";
import type { BudgetCondition, MealTime, ParseResult, SearchConditions } from "@/lib/shared/types";

type DictEntry =
  | { kind: "area"; id: AreaId; word: string }
  | { kind: "city"; id: City; word: string }
  | { kind: "genre"; id: GenreId; word: string }
  | { kind: "scene"; id: SceneId; word: string }
  | { kind: "feature"; id: FeatureId; word: string };

/** 長い語から先に照合する（「新札幌」が「札幌」より先にマッチするように） */
const DICTIONARY: DictEntry[] = [
  ...AREAS.flatMap((a) => a.synonyms.map((word) => ({ kind: "area" as const, id: a.id, word }))),
  ...(Object.entries(CITY_SYNONYMS) as [City, string[]][]).flatMap(([id, words]) =>
    words.map((word) => ({ kind: "city" as const, id, word })),
  ),
  ...GENRES.flatMap((g) => g.synonyms.map((word) => ({ kind: "genre" as const, id: g.id, word }))),
  ...SCENES.flatMap((s) => s.synonyms.map((word) => ({ kind: "scene" as const, id: s.id, word }))),
  ...FEATURES.flatMap((f) => f.synonyms.map((word) => ({ kind: "feature" as const, id: f.id, word }))),
]
  .map((entry) => ({ ...entry, word: normalizeText(entry.word) }))
  .sort((a, b) => b.word.length - a.word.length);

const KANJI_DIGITS: Record<string, string> = {
  一: "1", 二: "2", 三: "3", 四: "4", 五: "5", 六: "6", 七: "7", 八: "8", 九: "9",
};

const STOPWORDS = new Set([
  "お店", "店", "おすすめ", "オススメ", "教えて", "探して", "向け", "行ける", "あり", "希望", "予算",
  "近く", "周辺", "付近", "エリア", "美味しい", "おいしい", "いい", "良い", "安い", "人気", "ところ", "場所",
  "ごはん", "ご飯", "食事", "料理", "お願い", "したい", "ください", "できる", "大丈夫", "以内", "くらい",
]);

/** 全角→半角、記号のゆれをそろえる */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[〜～]/g, "~")
    .replace(/[‐－―ー](?=\d)/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function toYen(numText: string, unit: string | undefined): number {
  const n = Number(numText.replace(/,/g, ""));
  if (unit === "万") return Math.round(n * 10000);
  if (unit === "千") return Math.round(n * 1000);
  return Math.round(n);
}

type Extracted<T> = { value: T; rest: string };

function extractBudget(text: string): Extracted<BudgetCondition | null> {
  // 漢数字＋千/万（例：五千円、一万円）を算用数字に
  let t = text.replace(/([一二三四五六七八九])(千|万)/g, (_, d: string, u: string) => `${KANJI_DIGITS[d]}${u}`);
  const num = String.raw`(\d+(?:[.,]\d+)*)\s*(万|千)?`;

  const range = new RegExp(String.raw`(?:予算\s*)?${num}\s*円?\s*(?:~|-|から)\s*${num}\s*円`);
  const r = t.match(range);
  if (r && r[1] && r[3]) {
    const a = toYen(r[1], r[2]);
    const b = toYen(r[3], r[4]);
    t = t.replace(r[0], " ");
    return { value: { min: Math.min(a, b), max: Math.max(a, b), target: null, strict: true }, rest: t };
  }

  const single = new RegExp(
    String.raw`(?:予算\s*|1人\s*|ひとり\s*)?${num}\s*(?:円|えん)\s*(以内|以下|まで|未満|以上|から|くらい|ぐらい|程度|前後|位)?`,
  );
  const s = t.match(single);
  const bare = s ? null : t.match(new RegExp(String.raw`予算\s*${num}`));
  const m = s ?? bare;
  if (m && m[1]) {
    const yen = toYen(m[1], m[2]);
    const modifier = s ? s[3] : undefined;
    t = t.replace(m[0], " ");
    if (yen < 100 || yen > 100000) return { value: null, rest: t };
    if (modifier === "以内" || modifier === "以下" || modifier === "まで" || modifier === "未満") {
      return { value: { min: null, max: yen, target: null, strict: true }, rest: t };
    }
    if (modifier === "以上" || modifier === "から") {
      return { value: { min: yen, max: null, target: null, strict: false }, rest: t };
    }
    return { value: { min: null, max: null, target: yen, strict: false }, rest: t };
  }
  return { value: null, rest: t };
}

function extractPartySize(text: string): Extracted<number | null> {
  const kanji: Record<string, number> = { ふたり: 2, 二人: 2, 三人: 3, 四人: 4, 五人: 5, 六人: 6 };
  for (const [word, n] of Object.entries(kanji)) {
    if (text.includes(word)) return { value: n, rest: text.replace(word, " ") };
  }
  const m = text.match(/(\d{1,2})\s*(人|名)(?:で|様)?/);
  if (m && m[1]) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 50) return { value: n, rest: text.replace(m[0], " ") };
  }
  return { value: null, rest: text };
}

function extractDateTime(text: string): { dateText: string | null; timeText: string | null; rest: string } {
  let rest = text;
  let dateText: string | null = null;
  let timeText: string | null = null;
  const date = rest.match(/(今日|明日|明後日|あさって|今夜|今晩|今週末|週末|来週|(?:月|火|水|木|金|土|日)曜日?|\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2})/);
  if (date) {
    dateText = date[0];
    rest = rest.replace(date[0], " ");
  }
  const time = rest.match(/(\d{1,2})\s*(?::\s*(\d{2})|時(?:\s*(\d{1,2})\s*分|半)?)(?:頃|ごろ|から|~)?/);
  if (time && time[1] && Number(time[1]) <= 29) {
    const minutes = time[2] ?? time[3] ?? (time[0].includes("半") ? "30" : "00");
    timeText = `${time[1]}:${minutes.padStart(2, "0")}`;
    rest = rest.replace(time[0], " ");
  }
  return { dateText, timeText, rest };
}

function detectMealTime(text: string, dateText: string | null, timeText: string | null): MealTime | null {
  if (/ランチ|昼ごはん|昼ご飯|昼食|お昼|(?<!真)昼/.test(text)) return "lunch";
  if (/ディナー|夕食|晩ごはん|晩ご飯|夜ごはん|夜ご飯|飲み|(?<!深)夜(?!景)/.test(text)) return "dinner";
  if (dateText === "今夜" || dateText === "今晩") return "dinner";
  if (timeText) {
    const hour = Number(timeText.split(":")[0]);
    if (hour >= 10 && hour < 15) return "lunch";
    if (hour >= 17 || hour < 5) return "dinner";
  }
  return null;
}

function extractKeywords(text: string): string[] {
  const tokens = text
    .split(/[\s、。,.!?！？・/()（）「」]+|(?:で|の|が|を|に|は|と|へ|や|も|な|ある|あり|向け|行ける)/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !STOPWORDS.has(token))
    // ひらがなだけの語は「いける」「おいしい」などの言い回しが多いので除外する
    .filter((token) => !/^[ぁ-んー]+$/.test(token))
    .filter((token) => !/^\d+$/.test(token));
  return [...new Set(tokens)].slice(0, 5);
}

const uniq = <T>(list: T[]) => [...new Set(list)];

/** 条件を正規化（重複除去・矛盾の解消）。LLM の出力もここを通す */
export function normalizeConditions(c: SearchConditions): SearchConditions {
  const areaIds = uniq(c.areaIds);
  // エリアが指定されていれば市レベルの指定は不要
  const cities = areaIds.length > 0 ? [] : uniq(c.cities);
  let budget = c.budget;
  if (budget && budget.min !== null && budget.max !== null && budget.min > budget.max) {
    budget = { ...budget, min: budget.max, max: budget.min };
  }
  const scenes = uniq(c.scenes);
  const mealTime = c.mealTime ?? (scenes.includes("lunch") ? "lunch" : null);
  return {
    ...c,
    areaIds,
    cities,
    genreIds: uniq(c.genreIds),
    budget,
    mealTime,
    scenes,
    features: uniq(c.features),
    keywords: uniq(c.keywords),
  };
}

export function emptyConditions(): SearchConditions {
  return {
    areaIds: [],
    cities: [],
    genreIds: [],
    budget: null,
    mealTime: null,
    scenes: [],
    features: [],
    partySize: null,
    dateText: null,
    timeText: null,
    keywords: [],
  };
}

export function hasAnyCondition(c: SearchConditions): boolean {
  return (
    c.areaIds.length > 0 ||
    c.cities.length > 0 ||
    c.genreIds.length > 0 ||
    c.budget !== null ||
    c.scenes.length > 0 ||
    c.features.length > 0 ||
    c.keywords.length > 0 ||
    c.mealTime !== null
  );
}

export function parseSearchText(input: string): ParseResult {
  const notes: string[] = [];
  const conditions = emptyConditions();
  let text = normalizeText(input).slice(0, 200);

  const budget = extractBudget(text);
  conditions.budget = budget.value;
  text = budget.rest;

  const party = extractPartySize(text);
  conditions.partySize = party.value;
  text = party.rest;

  const dt = extractDateTime(text);
  conditions.dateText = dt.dateText;
  conditions.timeText = dt.timeText;
  text = dt.rest;

  conditions.mealTime = detectMealTime(text, dt.dateText, dt.timeText);

  for (const entry of DICTIONARY) {
    if (!text.includes(entry.word)) continue;
    text = text.split(entry.word).join(" ");
    if (entry.kind === "area") conditions.areaIds.push(entry.id);
    else if (entry.kind === "city") conditions.cities.push(entry.id);
    else if (entry.kind === "genre") conditions.genreIds.push(entry.id);
    else if (entry.kind === "scene") conditions.scenes.push(entry.id);
    else conditions.features.push(entry.id);
  }

  if (conditions.partySize === 1 && !conditions.scenes.includes("solo")) conditions.scenes.push("solo");

  // 食事時間の語（ランチ・ディナー等）はキーワードから外す
  text = text.replace(/ランチ|ディナー|昼ごはん|昼ご飯|昼食|お昼|夕食|晩ごはん|晩ご飯|夜ごはん|夜ご飯|飲み|昼|夜(?!景)/g, " ");
  conditions.keywords = extractKeywords(text);

  const normalized = normalizeConditions(conditions);
  if (!hasAnyCondition(normalized)) {
    notes.push("条件を読み取れませんでした。「すすきの 焼肉 予算5000円」のように、エリア・ジャンル・予算を入れてみてください。");
  } else {
    if (normalized.areaIds.length === 0 && normalized.cities.length === 0) notes.push("エリアの指定がないため、北海道内のサンプル店舗全体から探しました。");
    if (normalized.budget && normalized.partySize && normalized.partySize > 1) notes.push("予算は1人あたりの金額として扱っています。");
  }
  if (normalized.dateText || normalized.timeText) {
    notes.push("日時は参考情報です。空席状況は確認していないため、予約リンク先でご確認ください。");
  }

  return { conditions: normalized, parser: "rule", notes };
}
