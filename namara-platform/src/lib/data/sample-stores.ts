/**
 * サンプル店舗マスター（すべて架空）。
 *
 * - 実在の店舗・個人とは関係ありません。店名には必ず「（架空）」を付けています。
 * - 乱数シードを固定して毎回同じ店舗が生成されるようにしています（テストと画面の再現性のため）。
 * - 本番では運営が検証した店舗を Supabase の stores テーブルに登録し、このファイルは使いません。
 */
import { AREAS, type AreaId, type FeatureId, type GenreId, type SceneId } from "@/lib/shared/dictionaries";
import type { PriceRange, Store } from "@/lib/shared/types";
import { createRng } from "@/lib/shared/random";

type GenreProfile = {
  words: string[];
  lunch: PriceRange | null;
  lunchRate: number;
  dinner: PriceRange;
  scenes: SceneId[];
  features: Partial<Record<FeatureId, number>>;
  tags: string[];
};

const PROFILES: Record<GenreId, GenreProfile> = {
  yakiniku: { words: ["焼肉", "炭火焼肉", "ホルモン"], lunch: { min: 1200, max: 2000 }, lunchRate: 0.4, dinner: { min: 4000, max: 8000 }, scenes: ["date", "family", "party", "business"], features: { private_room: 0.5, non_smoking: 0.5, kids_friendly: 0.5, parking: 0.3, all_you_can_drink: 0.5 }, tags: ["和牛", "道産牛", "厚切りタン", "食べ放題"] },
  jingisukan: { words: ["ジンギスカン", "成吉思汗"], lunch: { min: 1200, max: 1800 }, lunchRate: 0.3, dinner: { min: 2800, max: 5000 }, scenes: ["tourist", "party", "solo"], features: { counter: 0.7, non_smoking: 0.3, late_night: 0.4, all_you_can_drink: 0.4 }, tags: ["生ラム", "道産ラム", "七輪"] },
  sushi: { words: ["鮨", "寿司", "すし処"], lunch: { min: 1800, max: 4000 }, lunchRate: 0.6, dinner: { min: 5000, max: 15000 }, scenes: ["date", "anniversary", "business", "tourist"], features: { counter: 0.9, private_room: 0.4, non_smoking: 0.8 }, tags: ["おまかせ", "地酒", "道産ネタ", "ウニ"] },
  kaisen: { words: ["海鮮", "海鮮酒場", "浜焼き"], lunch: { min: 1500, max: 3000 }, lunchRate: 0.8, dinner: { min: 3000, max: 7000 }, scenes: ["tourist", "family", "party"], features: { kids_friendly: 0.6, private_room: 0.4, non_smoking: 0.6, all_you_can_drink: 0.4, parking: 0.3 }, tags: ["海鮮丼", "カニ", "炉端焼き", "朝獲れ"] },
  ramen: { words: ["らーめん", "麺屋", "中華そば"], lunch: { min: 900, max: 1400 }, lunchRate: 1, dinner: { min: 900, max: 1500 }, scenes: ["solo", "lunch", "tourist"], features: { counter: 0.9, late_night: 0.5, kids_friendly: 0.4, non_smoking: 0.9 }, tags: ["味噌", "醤油", "塩", "シメのラーメン"] },
  "soup-curry": { words: ["スープカレー", "カリー食堂"], lunch: { min: 1200, max: 1900 }, lunchRate: 1, dinner: { min: 1300, max: 2200 }, scenes: ["lunch", "solo", "date", "tourist"], features: { non_smoking: 1, kids_friendly: 0.6, parking: 0.3, takeout: 0.5 }, tags: ["野菜たっぷり", "辛さ調整", "チキンレッグ"] },
  italian: { words: ["トラットリア", "イタリアン食堂", "ピッツェリア"], lunch: { min: 1300, max: 2500 }, lunchRate: 0.8, dinner: { min: 3500, max: 8000 }, scenes: ["date", "anniversary", "girls", "lunch"], features: { non_smoking: 0.9, private_room: 0.55, kids_friendly: 0.3, all_you_can_drink: 0.3 }, tags: ["ワイン", "窯焼きピッツァ", "道産チーズ", "夜景"] },
  french: { words: ["ビストロ", "レストラン"], lunch: { min: 2500, max: 5000 }, lunchRate: 0.5, dinner: { min: 7000, max: 15000 }, scenes: ["date", "anniversary", "business"], features: { non_smoking: 1, private_room: 0.6 }, tags: ["コース", "ワイン", "記念日プレート", "夜景"] },
  izakaya: { words: ["居酒屋", "酒場", "炉端"], lunch: null, lunchRate: 0, dinner: { min: 3000, max: 5000 }, scenes: ["party", "business", "girls"], features: { private_room: 0.6, all_you_can_drink: 0.8, late_night: 0.5, non_smoking: 0.3 }, tags: ["地酒", "道産食材", "宴会コース"] },
  yakitori: { words: ["焼き鳥", "串焼き"], lunch: null, lunchRate: 0, dinner: { min: 2500, max: 4500 }, scenes: ["solo", "party", "date"], features: { counter: 0.8, late_night: 0.4, all_you_can_drink: 0.3 }, tags: ["備長炭", "地鶏", "日本酒"] },
  washoku: { words: ["和食", "割烹", "蕎麦"], lunch: { min: 1200, max: 3000 }, lunchRate: 0.7, dinner: { min: 4000, max: 10000 }, scenes: ["business", "family", "anniversary"], features: { private_room: 0.7, non_smoking: 0.8, kids_friendly: 0.3, parking: 0.3 }, tags: ["季節の会席", "手打ち", "地酒"] },
  chinese: { words: ["中華", "餃子", "飯店"], lunch: { min: 900, max: 1500 }, lunchRate: 0.9, dinner: { min: 1800, max: 4000 }, scenes: ["family", "party", "lunch"], features: { kids_friendly: 0.7, private_room: 0.4, parking: 0.3, takeout: 0.5 }, tags: ["麻婆豆腐", "焼き餃子", "円卓"] },
  cafe: { words: ["カフェ", "珈琲店", "喫茶"], lunch: { min: 900, max: 1600 }, lunchRate: 0.9, dinner: { min: 1000, max: 2000 }, scenes: ["solo", "girls", "date", "lunch"], features: { non_smoking: 1, kids_friendly: 0.6, takeout: 0.6 }, tags: ["自家焙煎", "ワークスペース", "ケーキ"] },
  sweets: { words: ["パフェ", "スイーツ"], lunch: null, lunchRate: 0, dinner: { min: 1200, max: 2200 }, scenes: ["girls", "date", "solo"], features: { non_smoking: 1, late_night: 0.6, takeout: 0.4 }, tags: ["シメパフェ", "季節のフルーツ"] },
  bar: { words: ["バー", "ワインバー"], lunch: null, lunchRate: 0, dinner: { min: 3000, max: 7000 }, scenes: ["date", "solo"], features: { counter: 0.9, late_night: 0.9 }, tags: ["カクテル", "ウイスキー", "夜景"] },
};

/** 架空であることが分かる、ありふれた語の組み合わせで店名を作る */
const NAME_WORDS = [
  "ゆきあかり", "しらかば", "ほしぞら", "はまなす", "きたかぜ", "こもれび", "ゆめぴりか", "つきみ",
  "あおば", "すずらん", "なないろ", "ひだまり", "みなと", "やまびこ", "ふゆごもり", "かぜのね",
];

/** エリアごとの店舗数（中心部を厚めに） */
const AREA_WEIGHTS: Record<AreaId, number> = {
  susukino: 38,
  odori: 28,
  "sapporo-station": 28,
  tanukikoji: 12,
  maruyama: 12,
  kotoni: 7,
  "shin-sapporo": 7,
  otaru: 12,
  hakodate: 12,
  asahikawa: 8,
};

const AREA_GENRE_BIAS: Partial<Record<AreaId, GenreId[]>> = {
  susukino: ["yakiniku", "yakiniku", "jingisukan", "izakaya", "ramen", "sweets", "bar", "sushi", "yakitori", "kaisen"],
  odori: ["italian", "italian", "cafe", "french", "washoku", "soup-curry", "kaisen"],
  "sapporo-station": ["kaisen", "sushi", "ramen", "izakaya", "chinese", "cafe", "soup-curry", "italian"],
  maruyama: ["cafe", "french", "italian", "sweets", "soup-curry"],
  otaru: ["sushi", "kaisen", "cafe", "sweets"],
  hakodate: ["kaisen", "sushi", "ramen", "cafe"],
  asahikawa: ["ramen", "yakiniku", "jingisukan", "izakaya"],
};

const ALL_GENRES = Object.keys(PROFILES) as GenreId[];

/** デモの基準日（サンプルの「確認日」はこの日から逆算） */
export const SAMPLE_BASE_DATE = "2026-10-01";

function roundPrice(yen: number): number {
  return Math.round(yen / 100) * 100;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const DEMO_ORGANIZATIONS = [
  { id: "org-demo-1", name: "架空フードサービス株式会社（デモ）", plan: "growth" as const },
  { id: "org-demo-2", name: "架空ダイニング合同会社（デモ）", plan: "starter" as const },
];

/**
 * デモの契約店舗（ログイン後のダッシュボードで使う3店舗）。
 * 表示確認しやすいよう、情報がそろった状態で手作りしている。
 */
function featuredDemoStores(): Store[] {
  const verifiedAt = addDays(SAMPLE_BASE_DATE, -50);
  const base = {
    isSample: true,
    published: true,
    websiteUrl: null,
    photo: null,
    verification: { status: "verified" as const, verifiedAt, source: "sample" as const },
    updatedAt: verifiedAt,
  };
  return [
    {
      ...base,
      id: "store-001",
      name: "炭火焼肉 ゆきあかり すすきの本店（架空）",
      areaId: "susukino",
      city: "札幌市",
      address: "札幌市（すすきの周辺・架空の住所）",
      genreIds: ["yakiniku"],
      scenes: ["date", "party", "business", "family"],
      features: ["private_room", "non_smoking", "all_you_can_drink", "kids_friendly"],
      tags: ["道産牛", "厚切りタン"],
      budget: { lunch: null, dinner: { min: 5000, max: 7500 }, basis: "店舗提供メニュー表（架空データ）" },
      hours: "17:00〜23:30（架空）",
      reservationUrl: "https://example.com/reserve/store-001",
      location: { lat: 43.0551, lng: 141.3541, approximate: true },
      organizationId: "org-demo-1",
    },
    {
      ...base,
      id: "store-002",
      name: "海鮮酒場 しらかば 札幌駅前店（架空）",
      areaId: "sapporo-station",
      city: "札幌市",
      address: "札幌市（札幌駅周辺・架空の住所）",
      genreIds: ["kaisen", "izakaya"],
      scenes: ["party", "tourist", "family", "lunch"],
      features: ["private_room", "kids_friendly", "all_you_can_drink"],
      tags: ["海鮮丼", "炉端焼き", "地酒"],
      budget: { lunch: { min: 1300, max: 2200 }, dinner: { min: 3500, max: 5500 }, basis: "店舗提供メニュー表（架空データ）" },
      hours: "11:30〜14:00 / 17:00〜23:00（架空）",
      reservationUrl: "https://example.com/reserve/store-002",
      location: { lat: 43.0682, lng: 141.3513, approximate: true },
      organizationId: "org-demo-1",
    },
    {
      ...base,
      id: "store-003",
      name: "トラットリア はまなす 大通店（架空）",
      areaId: "odori",
      city: "札幌市",
      address: "札幌市（大通周辺・架空の住所）",
      genreIds: ["italian"],
      scenes: ["date", "anniversary", "girls", "lunch"],
      features: ["non_smoking", "private_room"],
      tags: ["窯焼きピッツァ", "ワイン", "道産チーズ"],
      budget: { lunch: { min: 1500, max: 2400 }, dinner: { min: 4000, max: 6500 }, basis: "店舗提供メニュー表（架空データ）" },
      hours: null,
      reservationUrl: null,
      location: { lat: 43.0601, lng: 141.3552, approximate: true },
      organizationId: "org-demo-2",
    },
  ];
}

function generateSampleStores(): Store[] {
  const rng = createRng(20261022);
  const stores: Store[] = featuredDemoStores();
  const usedNames = new Set<string>(stores.map((s) => s.name));
  let serial = stores.length + 1;

  for (const area of AREAS) {
    const count = AREA_WEIGHTS[area.id];
    const bias = AREA_GENRE_BIAS[area.id] ?? ALL_GENRES;
    for (let i = 0; i < count; i += 1) {
      const genreId = rng.next() < 0.7 ? rng.pick(bias) : rng.pick(ALL_GENRES);
      const profile = PROFILES[genreId];
      const secondary = rng.next() < 0.25 ? GENRES_RELATED[genreId] : undefined;
      const genreIds: GenreId[] = secondary ? [genreId, secondary] : [genreId];

      let name = "";
      for (let attempt = 0; attempt < 20 && (!name || usedNames.has(name)); attempt += 1) {
        name = `${rng.pick(profile.words)} ${rng.pick(NAME_WORDS)} ${area.label}店（架空）`;
      }
      if (usedNames.has(name)) name = `${rng.pick(profile.words)} ${rng.pick(NAME_WORDS)} ${area.label}${serial}号店（架空）`;
      usedNames.add(name);

      const priceShift = 0.8 + rng.next() * 0.5;
      const dinnerMin = roundPrice(profile.dinner.min * priceShift);
      const dinner: PriceRange = { min: dinnerMin, max: Math.max(dinnerMin + 500, roundPrice(profile.dinner.max * priceShift)) };
      const hasLunch = profile.lunch !== null && rng.next() < profile.lunchRate;
      const lunch: PriceRange | null =
        hasLunch && profile.lunch
          ? { min: roundPrice(profile.lunch.min * priceShift), max: roundPrice(profile.lunch.max * priceShift) }
          : null;

      const features = (Object.entries(profile.features) as [FeatureId, number][])
        .filter(([, rate]) => rng.next() < rate)
        .map(([id]) => id);
      const scenes = profile.scenes.filter(() => rng.next() < 0.7);
      if (hasLunch && !scenes.includes("lunch")) scenes.push("lunch");
      if (features.includes("kids_friendly") && !scenes.includes("family")) scenes.push("family");
      const tags = profile.tags.filter(() => rng.next() < 0.5);

      const id = `store-${String(serial).padStart(3, "0")}`;
      // 一部の店舗は「価格の根拠不明」「営業時間不明」「確認が古い」「未検証」「非公開」にして、表示ルールを確認できるようにする
      const basisUnknown = rng.next() < 0.08;
      const hoursUnknown = rng.next() < 0.15;
      const verifiedDaysAgo = rng.next() < 0.1 ? 200 + rng.int(0, 150) : rng.int(3, 120);
      const unverified = rng.next() < 0.04;
      const unpublished = rng.next() < 0.03;

      stores.push({
        id,
        name,
        isSample: true,
        published: !unpublished,
        areaId: area.id,
        city: area.city,
        address: `${area.city}（${area.label}周辺・架空の住所）`,
        genreIds,
        scenes,
        features,
        tags,
        budget: {
          lunch: basisUnknown ? null : lunch,
          dinner: basisUnknown ? null : dinner,
          basis: basisUnknown ? null : "店舗提供メニュー表（架空データ）",
        },
        hours: hoursUnknown ? null : hasLunch ? "11:30〜14:30 / 17:00〜22:00（架空）" : "17:00〜23:00（架空）",
        reservationUrl: rng.next() < 0.5 ? `https://example.com/reserve/${id}` : null,
        websiteUrl: null,
        photo: null,
        location: {
          lat: Number((area.center.lat + (rng.next() - 0.5) * 0.006).toFixed(5)),
          lng: Number((area.center.lng + (rng.next() - 0.5) * 0.006).toFixed(5)),
          approximate: true,
        },
        verification: {
          status: unverified ? "unverified" : "verified",
          verifiedAt: unverified ? null : addDays(SAMPLE_BASE_DATE, -verifiedDaysAgo),
          source: "sample",
        },
        organizationId: null,
        updatedAt: addDays(SAMPLE_BASE_DATE, -verifiedDaysAgo),
      });
      serial += 1;
    }
  }

  return stores;
}

const GENRES_RELATED: Partial<Record<GenreId, GenreId>> = {
  sushi: "kaisen",
  kaisen: "izakaya",
  izakaya: "yakitori",
  yakiniku: "izakaya",
  cafe: "sweets",
  italian: "bar",
  washoku: "sushi",
};

export const SAMPLE_STORES: readonly Store[] = generateSampleStores();
