/** 業務ツール（キャスティング管理）のデータ型 */

export type Creator = {
  id: string;
  name: string;
  /** SNSアカウント（@なし） */
  account: string;
  platform: string;
  followers?: number;
  email?: string;
  /** 公式LINEと連携済みの場合の LINE userId */
  lineUserId?: string;
  /** 公式LINEに送ってもらう連携コード */
  lineLinkCode: string;
  /** 発信者専用ページ（/m/[token]）のトークン */
  token: string;
  memo?: string;
  active: boolean;
  createdAt: string;
};

export type Restaurant = {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  memo?: string;
  createdAt: string;
};

export type Slot = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  start: string;
  end: string;
  /** この枠に入れる人数 */
  capacity: number;
};

export type Campaign = {
  id: string;
  restaurantId: string;
  title: string;
  /** PR内容（お店・メニュー・訴求ポイントなど） */
  description: string;
  /** 発信者への報酬・特典 */
  offer: string;
  /** 投稿条件（形式・タグ・メンションなど） */
  conditions: string;
  slots: Slot[];
  /** 回答期限 YYYY-MM-DD */
  replyDeadline: string;
  /** 投稿期限 YYYY-MM-DD */
  postDeadline: string;
  /** 飲食店向けページ（/p/[token]）のトークン */
  shareToken: string;
  scheduleSharedAt?: string;
  reportSentAt?: string;
  /** レポート：サマリー（表紙） */
  reportComment?: string;
  /** レポート：対象期間（空なら投稿日から自動） */
  reportPeriod?: string;
  /** レポート：考察（1行1項目） */
  reportFindings?: string;
  /** レポート：次回施策のご提案（「見出し｜説明」を1行1項目） */
  reportProposals?: string;
  createdAt: string;
};

export type AssignmentStatus = "unsent" | "sent" | "accepted" | "declined";

export type Platform = "instagram" | "tiktok";

/** 割合の内訳（年齢・性別・閲覧ソースなど）。pct は 0〜100 */
export type Dist = { label: string; pct: number }[];

/** 数値のインサイト項目（insight-fields.ts の項目と対応） */
export type MetricKey =
  | "views"
  | "viewers"
  | "avgWatchSec"
  | "follows"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "newViewerPct"
  | "nonFollowerPct";

export type DistKey = "sources" | "age" | "gender";

export type Insight = {
  platform: Platform;
  metrics: Partial<Record<MetricKey, number>>;
  dists: Partial<Record<DistKey, Dist>>;
  /** 動画かどうか（Instagramの写真投稿には平均再生時間がない） */
  isVideo?: boolean;
  /** 必要なのにスクショに写っていなかった項目のキー */
  missing: string[];
  /** ai＝スクショから自動読み取り / manual＝管理画面で入力 */
  source: "ai" | "manual";
  /** 読み取りに使ったスクショの枚数 */
  analyzedShots: number;
  aiNote?: string;
  submittedAt: string;
};

/** インサイトのスクリーンショット（画像本体は db の blob に保存） */
export type Shot = {
  id: string;
  assignmentId: string;
  creatorId: string;
  via: "web" | "line" | "admin";
  mediaType: string;
  bytes: number;
  createdAt: string;
};

export type Assignment = {
  /** 推測できないランダム値（発信者ページのURLにも使用） */
  id: string;
  campaignId: string;
  creatorId: string;
  status: AssignmentStatus;
  sentAt?: string;
  sentVia?: Channel;
  /** 参加できると回答した枠 */
  availableSlotIds: string[];
  /** 確定した枠 */
  confirmedSlotId?: string;
  /** 投稿予定日 YYYY-MM-DD */
  plannedPostDate?: string;
  note?: string;
  respondedAt?: string;
  confirmedNotifiedAt?: string;
  replyRemindedAt?: string;
  shootRemindedAt?: string;
  postUrl?: string;
  insight?: Insight;
  insightRequestedAt?: string;
  insightRemindedAt?: string;
  /** スクショ不足を発信者に連絡した日時と、そのときの不足項目 */
  missingNotifiedAt?: string;
  missingNotifiedFor?: string;
  /** 投稿した媒体 */
  platform?: Platform;
  createdAt: string;
};

export type Channel = "line" | "email" | "manual";

export type MessageLog = {
  id: string;
  /** creator / restaurant */
  toKind: "creator" | "restaurant";
  toId: string;
  toName: string;
  channel: Channel;
  ok: boolean;
  /** 何の連絡か */
  purpose: string;
  text: string;
  error?: string;
  createdAt: string;
};

export type Collections = {
  creators: Creator;
  restaurants: Restaurant;
  campaigns: Campaign;
  assignments: Assignment;
  messages: MessageLog;
  shots: Shot;
};
export type CollectionName = keyof Collections;
