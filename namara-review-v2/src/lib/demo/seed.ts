import { generateReply } from "@/lib/ai/reply-generator";
import { DEMO_TODAY } from "@/lib/constants";
import type {
  AuditLog,
  Member,
  Organization,
  ReplyDraft,
  ReplyPublication,
  ReplyStatus,
  Review,
  ReviewTopic,
  Sentiment,
  Store,
  Topic,
} from "@/lib/types";
import { createRandom, type Random } from "./random";

/**
 * サンプルデータ（すべて架空の店舗・人物・口コミ）。
 * 外部APIに接続せずに全画面を操作できるよう、約1年分の口コミを決定的に生成する。
 */

export const DEMO_ORGANIZATION: Organization = {
  id: "org_demo",
  name: "株式会社なまらダイニング（デモ）",
  plan: "standard",
};

const baseNotifications = {
  lineNewReview: true,
  lineLowRatingOnly: false,
  lowRatingThreshold: 2 as const,
  lineDraftReady: true,
  linePublishResult: true,
  emailWeeklyReport: false,
};

export const DEMO_STORES: Store[] = [
  {
    id: "store_yakiniku",
    organizationId: DEMO_ORGANIZATION.id,
    name: "炭火焼肉 なまら亭 すすきの本店",
    shortName: "なまら亭 すすきの",
    genre: "焼肉",
    area: "札幌市中央区",
    address: "北海道札幌市中央区南4条西3丁目（架空）",
    phone: "011-000-0001",
    hours: "17:00〜24:00（L.O. 23:30）",
    googleStatus: "connected",
    googleLocationName: "locations/demo-0001",
    googleLastSyncedAt: "2026-10-21T17:45:00+09:00",
    lineStatus: "connected",
    policy: {
      tone: "friendly",
      signature: "炭火焼肉 なまら亭 店長",
      rules: ["お肉の部位名に触れられていたら、その部位名を使ってお礼を伝える", "「またのご来店をお待ちしております」で締める"],
      ngWords: ["激安", "コスパ最強"],
      lowRatingGuidance: "",
      maxLength: 300,
    },
    notifications: { ...baseNotifications },
  },
  {
    id: "store_izakaya",
    organizationId: DEMO_ORGANIZATION.id,
    name: "海鮮居酒屋 北の灯 札幌駅前店",
    shortName: "北の灯 札幌駅前",
    genre: "居酒屋",
    area: "札幌市北区",
    address: "北海道札幌市北区北7条西4丁目（架空）",
    phone: "011-000-0002",
    hours: "16:00〜23:00",
    googleStatus: "connected",
    googleLocationName: "locations/demo-0002",
    googleLastSyncedAt: "2026-10-21T17:45:00+09:00",
    lineStatus: "connected",
    policy: {
      tone: "polite",
      signature: "海鮮居酒屋 北の灯 札幌駅前店 スタッフ一同",
      rules: ["魚介の産地や仕入れ先など、口コミにない事実は書かない", "宴会利用の口コミには宴会コースの感謝を伝える"],
      ngWords: [],
      lowRatingGuidance: "",
      maxLength: 320,
    },
    notifications: { ...baseNotifications, lineLowRatingOnly: true },
  },
  {
    id: "store_cafe",
    organizationId: DEMO_ORGANIZATION.id,
    name: "なまらカフェ 円山",
    shortName: "なまらカフェ 円山",
    genre: "カフェ",
    area: "札幌市中央区",
    address: "北海道札幌市中央区北1条西27丁目（架空）",
    phone: "011-000-0003",
    hours: "10:00〜19:00（火曜定休）",
    googleStatus: "error",
    googleLocationName: "locations/demo-0003",
    googleLastSyncedAt: "2026-10-19T09:12:00+09:00",
    lineStatus: "not_connected",
    policy: {
      tone: "casual",
      signature: "なまらカフェ 円山",
      rules: ["絵文字は使わない", "季節メニューに触れられていたら季節のお礼を添える"],
      ngWords: [],
      lowRatingGuidance: "",
      maxLength: 260,
    },
    notifications: { ...baseNotifications, lineNewReview: false },
  },
];

export const DEMO_MEMBERS: Member[] = [
  {
    id: "user_owner",
    name: "山田 太郎",
    email: "owner@example.com",
    role: "owner",
    storeIds: DEMO_STORES.map((s) => s.id),
    lineLinked: true,
    lastActiveAt: "2026-10-21T17:40:00+09:00",
  },
  {
    id: "user_manager",
    name: "佐藤 花子",
    email: "manager@example.com",
    role: "manager",
    storeIds: ["store_yakiniku", "store_izakaya"],
    lineLinked: true,
    lastActiveAt: "2026-10-21T12:05:00+09:00",
  },
  {
    id: "user_staff",
    name: "鈴木 健",
    email: "staff@example.com",
    role: "staff",
    storeIds: ["store_cafe"],
    lineLinked: false,
    lastActiveAt: "2026-10-20T19:30:00+09:00",
  },
];

interface Fragment {
  topic: Topic;
  sentiment: Sentiment;
  text: string;
  keyword?: string;
}

const FOOD: Record<string, { positive: Fragment[]; negative: Fragment[] }> = {
  焼肉: {
    positive: [
      { topic: "food", sentiment: "positive", keyword: "上タン塩", text: "厚切りの上タン塩が本当においしかったです。" },
      { topic: "food", sentiment: "positive", keyword: "ハラミ", text: "ハラミがやわらかくてジューシーでした。" },
      { topic: "food", sentiment: "positive", keyword: "炭火焼き", text: "炭火で焼くお肉は香りが全然違います。" },
      { topic: "food", sentiment: "positive", keyword: "冷麺", text: "締めの冷麺がさっぱりしていて最高でした。" },
      { topic: "food", sentiment: "positive", keyword: "ジンギスカン", text: "ジンギスカンに臭みがなく、ラム肉が苦手な友人も喜んでいました。" },
    ],
    negative: [
      { topic: "food", sentiment: "negative", keyword: "カルビ", text: "カルビの脂が多く、少し重く感じました。" },
      { topic: "food", sentiment: "negative", keyword: "ホルモン", text: "ホルモンが少し硬かったのが残念です。" },
    ],
  },
  居酒屋: {
    positive: [
      { topic: "food", sentiment: "positive", keyword: "刺身の盛り合わせ", text: "刺身の盛り合わせが新鮮でボリュームもありました。" },
      { topic: "food", sentiment: "positive", keyword: "ザンギ", text: "ザンギが外はカリッと中はジューシーで絶品です。" },
      { topic: "food", sentiment: "positive", keyword: "ほっけ焼き", text: "肉厚のほっけ焼きは必ず頼みます。" },
      { topic: "food", sentiment: "positive", keyword: "海鮮丼", text: "ランチの海鮮丼がとても豪華でした。" },
    ],
    negative: [
      { topic: "food", sentiment: "negative", keyword: "味付け", text: "全体的に味付けが濃いめに感じました。" },
      { topic: "food", sentiment: "negative", keyword: "天ぷら", text: "天ぷらが少し油っぽかったです。" },
    ],
  },
  カフェ: {
    positive: [
      { topic: "food", sentiment: "positive", keyword: "季節のパフェ", text: "季節のパフェが見た目も味も素晴らしかったです。" },
      { topic: "food", sentiment: "positive", keyword: "自家焙煎コーヒー", text: "自家焙煎コーヒーの香りがとても良かったです。" },
      { topic: "food", sentiment: "positive", keyword: "チーズケーキ", text: "濃厚なチーズケーキがコーヒーによく合いました。" },
      { topic: "food", sentiment: "positive", keyword: "ランチプレート", text: "野菜たっぷりのランチプレートが体にやさしい味でした。" },
    ],
    negative: [
      { topic: "food", sentiment: "negative", keyword: "パンケーキ", text: "パンケーキが少し冷めていました。" },
      { topic: "food", sentiment: "negative", keyword: "量", text: "ランチの量が少し物足りなかったです。" },
    ],
  },
};

const COMMON: Fragment[] = [
  { topic: "service", sentiment: "positive", text: "スタッフの方の対応がとても丁寧でした。" },
  { topic: "service", sentiment: "positive", text: "笑顔で接客していただき、気持ちよく過ごせました。" },
  { topic: "service", sentiment: "negative", text: "店員さんの対応が少しそっけなく感じました。" },
  { topic: "service", sentiment: "negative", text: "注文を伝えても忘れられていることがありました。" },
  { topic: "price", sentiment: "positive", text: "このクオリティでこの価格はお得だと思います。" },
  { topic: "price", sentiment: "negative", text: "全体的に価格が少し高めに感じました。" },
  { topic: "atmosphere", sentiment: "positive", text: "落ち着いた雰囲気で会話も楽しめました。" },
  { topic: "atmosphere", sentiment: "positive", text: "内装がおしゃれで居心地が良かったです。" },
  { topic: "atmosphere", sentiment: "negative", text: "店内が騒がしく、会話がしにくかったです。" },
  { topic: "speed", sentiment: "positive", text: "料理の提供が早くて助かりました。" },
  { topic: "speed", sentiment: "negative", text: "料理が出てくるまで30分ほどかかりました。" },
  { topic: "speed", sentiment: "negative", text: "混雑していて、追加注文がなかなか届きませんでした。" },
  { topic: "cleanliness", sentiment: "positive", text: "店内が清潔で気持ちよかったです。" },
  { topic: "cleanliness", sentiment: "negative", text: "テーブルがべたついていたのが気になりました。" },
];

const OPENERS = [
  "家族で利用しました。",
  "友人と二人で訪問。",
  "仕事帰りに一人で寄りました。",
  "記念日に利用しました。",
  "会社の飲み会で利用させていただきました。",
  "観光で札幌に来た際に伺いました。",
  "",
  "",
];

const CLOSERS: Record<number, string[]> = {
  5: ["また必ず来ます！", "リピート確定です。", "札幌に来たらまた寄りたいです。"],
  4: ["また利用したいと思います。", "全体的には満足です。"],
  3: ["次回に期待します。", ""],
  2: ["改善されることを期待しています。", ""],
  1: ["残念な気持ちで帰りました。", ""],
};

const AUTHORS = [
  "Yuki T.", "たかはし", "グルメ好きの札幌人", "M. Sato", "ゆうこ", "Kenji", "あおい", "北海道食べ歩き",
  "Haruka N.", "とものり", "S. Ito", "まさき", "Riko", "けんた", "ひろみ", "Daisuke K.", "さっぽろ太郎",
  "Mina", "こうへい", "Aya W.", "なおみ", "Shun", "麺とお肉が好き", "かずや", "Emi O.", "りょう", "Tomo",
  "札幌ランチ部", "ちひろ", "Takumi",
];

const RATING_WEIGHTS: Record<string, [number, number, number, number, number]> = {
  // [★5, ★4, ★3, ★2, ★1]
  焼肉: [48, 28, 12, 7, 5],
  居酒屋: [36, 30, 17, 10, 7],
  カフェ: [54, 28, 10, 5, 3],
};

const MONTHLY_VOLUME: Record<string, [number, number]> = {
  焼肉: [12, 22],
  居酒屋: [10, 17],
  カフェ: [6, 12],
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function jstIso(year: number, month: number, day: number, hour = 12, minute = 0) {
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+09:00`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDays(iso: string, days: number, hour?: number) {
  const date = new Date(new Date(iso).getTime() + days * 86400000);
  const jst = new Date(date.getTime() + 9 * 3600000);
  return jstIso(jst.getUTCFullYear(), jst.getUTCMonth() + 1, jst.getUTCDate(), hour ?? jst.getUTCHours(), jst.getUTCMinutes());
}

function pickRating(rand: Random, genre: string, monthIndex: number): Review["rating"] {
  const [w5, w4, w3, w2, w1] = RATING_WEIGHTS[genre];
  // 直近ほど少しずつ評価が上向く（分析画面の推移を見せるため）
  const lift = monthIndex * 0.6;
  return rand.weighted([
    [5, w5 + lift * 2],
    [4, w4 + lift],
    [3, w3],
    [2, Math.max(1, w2 - lift * 0.5)],
    [1, Math.max(1, w1 - lift * 0.5)],
  ] as const) as Review["rating"];
}

function composeReview(rand: Random, genre: string, rating: Review["rating"]) {
  const food = FOOD[genre];
  const used = new Set<string>();
  const chosen: Fragment[] = [];
  const take = (pool: Fragment[], count: number) => {
    for (let i = 0; i < count; i++) {
      const candidates = pool.filter((f) => !used.has(f.topic));
      if (candidates.length === 0) return;
      const f = rand.pick(candidates);
      used.add(f.topic);
      chosen.push(f);
    }
  };
  const positiveCommon = COMMON.filter((f) => f.sentiment === "positive");
  const negativeCommon = COMMON.filter((f) => f.sentiment === "negative");

  if (rating === 5) {
    take(food.positive, 1);
    take(positiveCommon, rand.int(1, 2));
  } else if (rating === 4) {
    take(food.positive, 1);
    take(positiveCommon, 1);
    if (rand.chance(0.35)) take(negativeCommon, 1);
  } else if (rating === 3) {
    if (rand.chance(0.6)) take(food.positive, 1);
    else take(positiveCommon, 1);
    take(rand.chance(0.4) ? food.negative : negativeCommon, 1);
  } else {
    take(rand.chance(0.5) ? food.negative : negativeCommon, 1);
    take(negativeCommon, rand.int(0, 1));
    if (rand.chance(0.3)) take(food.positive, 1);
  }

  // ★4〜5 の一部は本文なし（Googleでは評価のみの投稿もある）
  if (rating >= 4 && rand.chance(0.08)) {
    return { text: "", topics: [] as ReviewTopic[] };
  }

  const opener = rand.pick(OPENERS);
  const closer = rand.pick(CLOSERS[rating]);
  const text = [opener, ...chosen.map((f) => f.text), closer].filter(Boolean).join("");
  const topics: ReviewTopic[] = chosen.map(({ topic, sentiment, keyword }) =>
    keyword && topic === "food" ? { topic, sentiment, keyword } : { topic, sentiment },
  );
  return { text, topics };
}

/** 新着口コミ（「Googleから同期」デモ用）を1件作る */
export function createIncomingReview(store: Store, sequence: number, createdAt: string): Review {
  const rand = createRandom(9000 + sequence * 31 + store.id.length);
  const rating = pickRating(rand, store.genre, 12);
  const { text, topics } = composeReview(rand, store.genre, rating);
  return {
    id: `rev_new_${store.id}_${sequence}`,
    storeId: store.id,
    googleReviewId: `g_${store.id}_new_${sequence}`,
    author: rand.pick(AUTHORS),
    rating,
    text,
    topics,
    createdAt,
    status: "unreplied",
    publishedReply: null,
  };
}

export interface SeedData {
  organization: Organization;
  stores: Store[];
  members: Member[];
  reviews: Review[];
  drafts: Record<string, ReplyDraft>;
  publications: ReplyPublication[];
  auditLogs: AuditLog[];
}

export function createSeedData(): SeedData {
  const rand = createRandom(20261021);
  const today = new Date(DEMO_TODAY);
  const reviews: Review[] = [];
  const drafts: Record<string, ReplyDraft> = {};
  const publications: ReplyPublication[] = [];
  const owner = DEMO_MEMBERS[0];

  for (const store of DEMO_STORES) {
    const [minVolume, maxVolume] = MONTHLY_VOLUME[store.genre];
    for (let monthIndex = 0; monthIndex <= 12; monthIndex++) {
      // 2025年10月 〜 2026年10月
      const year = monthIndex < 3 ? 2025 : 2026;
      const month = ((9 + monthIndex) % 12) + 1;
      const lastDay = monthIndex === 12 ? 21 : daysInMonth(year, month);
      const fullVolume = Math.round(minVolume + ((maxVolume - minVolume) * monthIndex) / 12) + rand.int(-2, 2);
      const volume = Math.max(1, Math.round((fullVolume * lastDay) / daysInMonth(year, month)));

      for (let i = 0; i < volume; i++) {
        const day = rand.int(1, lastDay);
        const hour = monthIndex === 12 && day === 21 ? rand.int(9, 17) : rand.int(10, 23);
        const createdAt = jstIso(year, month, day, hour, rand.int(0, 59));
        const rating = pickRating(rand, store.genre, monthIndex);
        const { text, topics } = composeReview(rand, store.genre, rating);
        const ageDays = (today.getTime() - new Date(createdAt).getTime()) / 86400000;
        const id = `rev_${store.id.replace("store_", "")}_${monthIndex}_${i}`;

        let status: ReplyStatus = "published";
        if (ageDays < 4) status = rand.weighted([["unreplied", 6], ["draft", 2], ["pending", 2]] as const);
        else if (ageDays < 21) status = rand.weighted([["published", 6], ["unreplied", 3], ["pending", 1]] as const);
        else if (rand.chance(0.06)) status = "unreplied";

        const review: Review = {
          id,
          storeId: store.id,
          googleReviewId: `g_${id}`,
          author: rand.pick(AUTHORS),
          rating,
          text,
          topics,
          createdAt,
          status,
          publishedReply: null,
        };

        if (status === "published") {
          const publishedAt = addDays(createdAt, rand.int(1, 3), rand.int(10, 21));
          const replyText = generateReply({ review, store, policy: store.policy, tone: store.policy.tone, variant: i });
          review.publishedReply = { text: replyText, publishedAt };
          publications.push({
            id: `pub_${id}`,
            reviewId: id,
            draftId: `draft_${id}`,
            idempotencyKey: `${id}:1`,
            status: "success",
            attempt: 1,
            attemptedAt: publishedAt,
            actor: owner.name,
            text: replyText,
            error: null,
          });
        } else if (status === "draft" || status === "pending") {
          drafts[id] = {
            id: `draft_${id}`,
            reviewId: id,
            text: generateReply({ review, store, policy: store.policy, tone: store.policy.tone, variant: i }),
            tone: store.policy.tone,
            source: "ai",
            version: 1,
            updatedAt: addDays(createdAt, 0, Math.min(23, hour + 1)),
            updatedBy: "AI（NAMARA REVIEW）",
            submittedAt: status === "pending" ? addDays(createdAt, 0, Math.min(23, hour + 1)) : null,
            submittedBy: status === "pending" ? DEMO_MEMBERS[1].name : null,
          };
        }
        reviews.push(review);
      }
    }
  }

  // 投稿失敗の例（Google連携エラーの店舗）
  const failedTarget = reviews
    .filter((r) => r.storeId === "store_cafe" && r.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (failedTarget) {
    failedTarget.status = "failed";
    const draft = drafts[failedTarget.id];
    publications.push({
      id: `pub_${failedTarget.id}_failed`,
      reviewId: failedTarget.id,
      draftId: draft.id,
      idempotencyKey: `${failedTarget.id}:${draft.version}`,
      status: "failed",
      attempt: 1,
      attemptedAt: "2026-10-20T10:02:00+09:00",
      actor: owner.name,
      text: draft.text,
      error: "Googleの認証の有効期限が切れています（デモ）。店舗設定からGoogle連携を再接続してください。",
    });
  }

  reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const auditLogs: AuditLog[] = [
    { id: "log_1", at: "2026-10-21T17:45:00+09:00", actor: "システム", action: "Google口コミを同期", target: "全店舗" },
    { id: "log_2", at: "2026-10-21T12:05:00+09:00", actor: DEMO_MEMBERS[1].name, action: "返信案を承認依頼", target: "北の灯 札幌駅前" },
    { id: "log_3", at: "2026-10-20T10:02:00+09:00", actor: owner.name, action: "返信の投稿に失敗", target: "なまらカフェ 円山" },
    { id: "log_4", at: "2026-10-19T09:12:00+09:00", actor: "システム", action: "Google連携エラーを検知", target: "なまらカフェ 円山" },
  ];

  return {
    organization: DEMO_ORGANIZATION,
    stores: DEMO_STORES,
    members: DEMO_MEMBERS,
    reviews,
    drafts,
    publications,
    auditLogs,
  };
}
