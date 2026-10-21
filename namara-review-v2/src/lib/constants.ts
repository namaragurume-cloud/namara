import type { PlanId, ReplyStatus, Role, Tone, Topic } from "./types";

/**
 * デモの「今日」。サンプルデータを常に同じ見え方にするため固定している。
 * Phase 2 で実データに切り替えたら現在時刻を使う。
 */
export const DEMO_TODAY = "2026-10-21T18:00:00+09:00";

export const TOPIC_LABELS: Record<Topic, string> = {
  food: "料理",
  service: "接客",
  price: "価格",
  atmosphere: "雰囲気",
  speed: "提供時間",
  cleanliness: "清潔感",
};

export const TOPICS: Topic[] = ["food", "service", "price", "atmosphere", "speed", "cleanliness"];

export const TONE_LABELS: Record<Tone, string> = {
  polite: "丁寧",
  friendly: "親しみやすい",
  casual: "カジュアル",
};

export const TONE_DESCRIPTIONS: Record<Tone, string> = {
  polite: "落ち着いた敬語。高級店・接待向け",
  friendly: "やわらかい敬語。多くの飲食店に合う標準",
  casual: "明るく元気な文体。カフェ・居酒屋向け",
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "オーナー",
  manager: "店長",
  staff: "スタッフ",
};

export const STATUS_LABELS: Record<ReplyStatus, string> = {
  unreplied: "未返信",
  draft: "下書き",
  pending: "承認待ち",
  publishing: "投稿中",
  published: "返信済み",
  failed: "投稿失敗",
};

export const PLANS: Record<PlanId, { name: string; price: number; stores: number; features: string[] }> = {
  starter: {
    name: "STARTER",
    price: 9800,
    stores: 1,
    features: ["口コミ一元管理", "AI返信案（月100件）", "LINE通知"],
  },
  standard: {
    name: "STANDARD",
    price: 19800,
    stores: 3,
    features: ["STARTERの全機能", "AI返信案（無制限）", "月次AI分析レポート", "スタッフ権限"],
  },
  premium: {
    name: "PREMIUM",
    price: 29800,
    stores: 10,
    features: ["STANDARDの全機能", "店舗別比較分析", "専任サポート", "返信ルールの個別設計"],
  },
};
