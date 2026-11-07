import "server-only";
import { addDays, jstDate } from "./dates";
import { missingKeys } from "./insight-fields";
import type { Assignment, Campaign, Collections, Creator, Dist, Insight, MessageLog, Restaurant, VideoVersion } from "./types";
import type { Extracted } from "./vision";

/**
 * デモ用のサンプルデータ。店舗・発信者はすべて架空です。
 * サーバーが複数台でも同じURLになるよう、IDとトークンは固定、日付は「今日」から計算します。
 */

type Seed = { [K in keyof Collections]: Collections[K][] };

const AGE_IG: Dist = [
  { label: "13-17", pct: 1.1 },
  { label: "18-24", pct: 11.4 },
  { label: "25-34", pct: 31.8 },
  { label: "35-44", pct: 20.6 },
  { label: "45-54", pct: 21.8 },
  { label: "55-64", pct: 10.8 },
  { label: "65+", pct: 2.5 },
];
const AGE_TT: Dist = [
  { label: "18 - 24", pct: 6 },
  { label: "25 - 34", pct: 17 },
  { label: "35 - 44", pct: 23 },
  { label: "45 - 54", pct: 34 },
  { label: "55+", pct: 20 },
];
const SOURCES: Dist = [
  { label: "フィード", pct: 72.7 },
  { label: "[リール]タブ", pct: 11.2 },
  { label: "ストーリーズ", pct: 10.4 },
  { label: "発見", pct: 4.8 },
  { label: "プロフィール", pct: 0.5 },
];
const gender = (f: number): Dist => [
  { label: "女性", pct: f },
  { label: "男性", pct: Math.round((100 - f) * 10) / 10 },
];

function ig(at: string, v: number, k: number, opts: { omit?: ("age" | "gender")[] } = {}): Insight {
  const i: Insight = {
    platform: "instagram",
    isVideo: true,
    metrics: {
      views: v,
      viewers: Math.round(v * 0.75),
      avgWatchSec: 8 + (k % 4) * 0.7,
      follows: Math.round(v / 900),
      likes: Math.round(v * 0.045),
      comments: Math.round(v * 0.0018),
      shares: Math.round(v * 0.003),
      saves: Math.round(v * 0.019),
      nonFollowerPct: 64 + k * 2.3,
    },
    dists: { sources: SOURCES, age: AGE_IG, gender: gender(60 + k) },
    missing: [],
    source: "ai",
    analyzedShots: 4,
    submittedAt: at,
  };
  for (const o of opts.omit ?? []) delete i.dists[o];
  i.missing = missingKeys(i);
  return i;
}

function tt(at: string, v: number, k: number): Insight {
  const i: Insight = {
    platform: "tiktok",
    isVideo: true,
    metrics: {
      views: v,
      likes: Math.round(v * 0.028),
      comments: Math.round(v * 0.0006) + 1,
      shares: Math.round(v * 0.0023),
      saves: Math.round(v * 0.0116),
      newViewerPct: 5 + k,
      nonFollowerPct: 95 - k,
    },
    dists: { age: AGE_TT, gender: gender(50 + k) },
    missing: [],
    source: "ai",
    analyzedShots: 2,
    submittedAt: at,
  };
  i.missing = missingKeys(i);
  return i;
}

export function demoSeed(): Seed {
  const today = jstDate();
  const d = (n: number) => addDays(today, n);
  const iso = (n: number, h = 12) => new Date(`${d(n)}T${String(h).padStart(2, "0")}:00:00+09:00`).toISOString();

  const restaurants: Restaurant[] = [
    { id: "r-taiyo", name: "焼肉 たいよう（デモ）", contactName: "山田", email: "taiyo@example.com", address: "札幌市中央区南5条西3丁目（架空）", createdAt: iso(-60) },
    { id: "r-hare", name: "スープカレー 晴れ（デモ）", contactName: "佐藤", email: "hare@example.com", lineUserId: "Udemo-shop", lineLinkCode: "SHOP01", address: "札幌市北区北18条西4丁目（架空）", createdAt: iso(-50) },
    { id: "r-shiokaze", name: "海鮮食堂 しおかぜ（デモ）", contactName: "鈴木", address: "小樽市色内1丁目（架空）", createdAt: iso(-90) },
    { id: "r-kotori", name: "カフェ ことり（デモ）", contactName: "高橋", email: "kotori@example.com", address: "札幌市中央区大通西10丁目（架空）", createdAt: iso(-20) },
  ];

  const names: [string, string, number, "line" | "email" | "none", string][] = [
    ["はなこ", "demo_hanako_gourmet", 48000, "line", "Instagram"],
    ["たろう", "demo_taro_tiktok", 32000, "line", "TikTok"],
    ["さくら", "demo_sakura_eats", 61000, "line", "Instagram"],
    ["けんた", "demo_kenta_ramen", 21000, "email", "Instagram"],
    ["みゆ", "demo_miyu_cafe", 15000, "line", "Instagram"],
    ["ゆうと", "demo_yuto_tiktok", 54000, "line", "TikTok"],
    ["あおい", "demo_aoi_sweets", 12000, "email", "Instagram"],
    ["りく", "demo_riku_meat", 27000, "none", "Instagram"],
  ];
  const creators: Creator[] = names.map(([name, account, followers, ch, platform], i) => ({
    id: `c${i + 1}`,
    name,
    account,
    platform,
    followers,
    email: ch === "email" ? `${account}@example.com` : undefined,
    lineUserId: ch === "line" ? `Udemo${i + 1}` : undefined,
    lineLinkCode: `DEMO${String(i + 1).padStart(2, "0")}`,
    token: `demo-creator-${i + 1}`,
    active: true,
    createdAt: iso(-100 + i),
  }));

  const slot = (id: string, n: number, start = "18:00", end = "20:00", capacity = 2) => ({ id, date: d(n), start, end, capacity });
  const campaigns: Campaign[] = [
    {
      id: "k-kotori",
      restaurantId: "r-kotori",
      title: "冬季限定パフェPR",
      description: "12月から始まる冬季限定「いちごとほうじ茶のパフェ」を紹介してください。店内の雰囲気もぜひ。",
      offer: "パフェ＋ドリンク無料（1名様）＋謝礼 5,000円",
      conditions: "リール1本／店舗アカウントをタグ付け／#PR 表記",
      slots: [slot("s1", 8, "14:00", "16:00"), slot("s2", 9, "14:00", "16:00"), slot("s3", 12, "11:00", "13:00", 1)],
      replyDeadline: d(3),
      postDates: [d(14), d(15), d(16), d(18)],
      postDeadline: d(18),
      shareToken: "demo-report-kotori",
      liveShare: true,
      createdAt: iso(-2),
    },
    {
      id: "k-hare",
      restaurantId: "r-hare",
      title: "新メニュー「ラムスープカレー」PR",
      description: "新メニューのラムスープカレーを中心に紹介してください。",
      offer: "飲食代無料（2名様まで）＋謝礼 8,000円",
      conditions: "リール1本 or TikTok1本／#PR 表記",
      slots: [slot("s0", -2, "18:00", "20:00", 3), slot("s1", 1), slot("s2", 6), slot("s3", 7)],
      replyDeadline: d(-3),
      postDates: [d(9), d(10), d(12)],
      postDeadline: d(12),
      shareToken: "demo-report-hare",
      liveShare: true,
      videoCheck: "owner_first",
      scheduleSharedAt: iso(-1),
      createdAt: iso(-10),
    },
    {
      id: "k-taiyo",
      restaurantId: "r-taiyo",
      title: "快すぎる肉盛りPR",
      description: "看板の「たいよう盛り」を中心に、コスパの良さを伝えてください。",
      offer: "飲食代無料（2名様まで）",
      conditions: "リール1本 or TikTok1本／店舗アカウントをタグ付け",
      slots: [slot("s1", -30, "18:00", "20:00", 3), slot("s2", -28, "18:00", "20:00", 3)],
      replyDeadline: d(-35),
      postDates: [d(-21), d(-20), d(-19), d(-18), d(-17)],
      postDeadline: d(-17),
      shareToken: "demo-report-taiyo",
      liveShare: true,
      scheduleSharedAt: iso(-33),
      createdAt: iso(-40),
    },
    {
      id: "k-shiokaze",
      restaurantId: "r-shiokaze",
      title: "秋の海鮮丼PR",
      description: "秋限定の「いくらとサーモンの親子丼」を紹介してください。",
      offer: "飲食代無料＋謝礼 5,000円",
      conditions: "リール1本／#PR 表記",
      slots: [slot("s1", -60, "11:00", "13:00", 3), slot("s2", -58, "11:00", "13:00", 3)],
      replyDeadline: d(-65),
      postDates: [d(-50), d(-49), d(-48), d(-47)],
      postDeadline: d(-47),
      shareToken: "demo-report-shiokaze",
      scheduleSharedAt: iso(-63),
      reportSentAt: iso(-20),
      reportComment: "4名の発信者による4投稿で、総閲覧数は約14万回となりました。フォロワー以外への到達が7割を超え、新しいお客様の層に広く届いています。保存数も多く、来店を検討する反応が多く見られました。（デモ用の文章です）",
      reportFindings:
        "TikTokの1投稿で全体の約3割の閲覧数を獲得し、拡散の中心となりました。\n保存数が多く、「あとで行きたい」と考える層に届いています。\n閲覧者は25〜54歳が中心で、来店の決定権を持つ層と重なっています。",
      reportProposals:
        "TikTokの起用を増やす｜非フォロワーへの到達が9割を超え、新規層への認知に効果的です。\n保存されるリールを継続｜メニューと価格がわかる構成が保存につながっています。\n来店導線を強化｜ストーリーズでのリンク・地図の追加依頼で来店につなげます。",
      createdAt: iso(-70),
    },
  ];

  let n = 0;
  // 依頼した日（月別の進捗に使う）
  const sentDay: Record<string, number> = { "k-kotori": -2, "k-hare": -12, "k-taiyo": -38, "k-shiokaze": -68 };
  const as = (campaignId: string, creatorId: string, p: Partial<Assignment>): Assignment => ({
    id: `demo-a${++n}`,
    campaignId,
    creatorId,
    status: "sent",
    sentAt: iso(sentDay[campaignId], 10),
    sentVia: "line",
    availableSlotIds: [],
    createdAt: iso(sentDay[campaignId], 10),
    ...p,
  });
  const done = (slotId: string, post: number, extra: Partial<Assignment> = {}): Partial<Assignment> => ({
    status: "accepted",
    availableSlotIds: [slotId],
    confirmedSlotId: slotId,
    plannedPostDate: d(post),
    respondedAt: iso(post - 8),
    confirmedNotifiedAt: iso(post - 7),
    ...extra,
  });

  let vn = 0;
  const vid = (day: number, extra: Partial<VideoVersion> = {}): VideoVersion => ({
    id: `demo-v${++vn}`,
    url: "",
    storageKey: "demo",
    storage: "demo",
    size: 48_000_000,
    contentType: "video/mp4",
    uploadedAt: iso(day, 11),
    ...extra,
  });

  const assignments: Assignment[] = [
    // カフェ ことり：回答受付中
    as("k-kotori", "c1", { status: "accepted", availableSlotIds: ["s1", "s2"], plannedPostDate: d(15), respondedAt: iso(-1) }),
    as("k-kotori", "c3", { status: "accepted", availableSlotIds: ["s1"], plannedPostDate: d(14), respondedAt: iso(-1), note: "同伴1名でもよいですか？" }),
    as("k-kotori", "c5", { status: "accepted", availableSlotIds: ["s2", "s3"], respondedAt: iso(0, 9) }),
    as("k-kotori", "c7", { status: "declined", respondedAt: iso(-1), sentVia: "email", note: "今月は予定が埋まっています" }),
    as("k-kotori", "c2", {}),
    as("k-kotori", "c8", { status: "unsent", sentAt: undefined, sentVia: undefined }),
    // スープカレー 晴れ：撮影待ち
    as("k-hare", "c2", done("s1", 9, { platform: "tiktok" })),
    as("k-hare", "c4", done("s0", 9, { sentVia: "email", videoRequestedAt: iso(-1, 10), videos: [vid(-1, { owner: { status: "ok", at: iso(-1, 15), by: "admin" }, sentToShopAt: iso(-1, 15) })] })),
    as("k-hare", "c6", done("s0", 10, { platform: "tiktok", videoRequestedAt: iso(-1, 10), videos: [vid(-1, { owner: { status: "ng", comment: "冒頭3秒でカレーのアップを見せてください", at: iso(-1, 16), by: "admin" } }), vid(0)] })),
    // 焼肉 たいよう：インサイト回収中
    as("k-taiyo", "c1", done("s1", -20, { postUrl: "https://www.instagram.com/", insight: ig(iso(-1), 48200, 1), insightRequestedAt: iso(-4) })),
    as("k-taiyo", "c2", done("s1", -21, { insight: tt(iso(-2), 92400, 1), insightRequestedAt: iso(-4) })),
    as("k-taiyo", "c3", done("s2", -18, { insight: ig(iso(-1), 35600, 3, { omit: ["age", "gender"] }), insightRequestedAt: iso(-4), missingNotifiedAt: iso(-1), missingNotifiedFor: "年齢,性別" })),
    as("k-taiyo", "c6", done("s2", -19, { insight: tt(iso(-3), 63100, 2), insightRequestedAt: iso(-4) })),
    as("k-taiyo", "c4", done("s1", -17, { insightRequestedAt: iso(-4), sentVia: "email" })),
    // 海鮮食堂 しおかぜ：完了
    as("k-shiokaze", "c1", done("s1", -50, { insight: ig(iso(-25), 41800, 0), insightRequestedAt: iso(-30) })),
    as("k-shiokaze", "c3", done("s1", -49, { insight: ig(iso(-25), 28900, 2), insightRequestedAt: iso(-30) })),
    as("k-shiokaze", "c5", done("s2", -47, { insight: ig(iso(-24), 18300, 4), insightRequestedAt: iso(-30) })),
    as("k-shiokaze", "c6", done("s2", -48, { insight: tt(iso(-26), 52700, 0), insightRequestedAt: iso(-30) })),
  ];

  const messages: MessageLog[] = [
    { id: "demo-m1", toKind: "creator", toId: "c3", toName: "さくら", channel: "line", ok: true, purpose: "インサイト不足の連絡（Instagram）", text: "さくらさん\n\nスクリーンショットありがとうございます！焼肉 たいよう（デモ）の投稿で、次の項目が画像に写っていませんでした。\n・年齢\n・性別\n\nこの項目が写っている画面のスクショを追加でこのトークに送ってください。\n（デモのサンプルです）", createdAt: iso(-1, 15) },
    { id: "demo-m2", toKind: "creator", toId: "c1", toName: "はなこ", channel: "line", ok: true, purpose: "PR依頼：冬季限定パフェPR", text: "はなこさん\n\nいつもありがとうございます！\nカフェ ことり（デモ）さんのPRのご依頼です。\n（デモのサンプルです）", createdAt: iso(-2, 10) },
  ];

  return { restaurants, creators, campaigns, assignments, messages, shots: [], templates: [] };
}

/** デモ：スクショを読み取ったことにするサンプルの数値（実際の画像は読んでいない） */
export function demoExtract(images: number): Extracted {
  const full = images >= 2;
  return {
    platform: "instagram",
    isVideo: true,
    metrics: { views: 26400, viewers: 19800, avgWatchSec: 8.6, follows: 24, likes: 1180, comments: 41, shares: 77, saves: 503, nonFollowerPct: 68.4 },
    dists: full ? { sources: SOURCES, age: AGE_IG, gender: gender(62) } : { sources: SOURCES },
    unrelatedImages: 0,
    note: full
      ? "デモのため画像は読み取らず、サンプルの数値を入れています"
      : "デモのため画像は読み取らず、サンプルの数値を入れています（1枚だけだと年齢・性別が足りない例になります。もう1枚追加するとそろいます）",
  };
}

export const demoDraft = {
  summary: "デモ用の下書きです。実際にはAIが集計結果からサマリーを書きます。",
  findings: ["（デモ）フォロワー以外への到達が7割を超え、新しい層に届いています。", "（デモ）保存数が多く、来店を検討する反応が見られました。"],
  proposals: [
    { title: "（デモ）TikTokの起用を増やす", body: "非フォロワーへの到達が高く、認知拡大に効果的です。" },
    { title: "（デモ）保存されるリールを継続", body: "メニューと価格がわかる構成が保存につながっています。" },
  ],
};
