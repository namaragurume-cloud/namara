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
  /** レポートに載せる担当者コメント */
  reportComment?: string;
  createdAt: string;
};

export type AssignmentStatus = "unsent" | "sent" | "accepted" | "declined";

export type Insight = {
  views: number;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  profileVisits?: number;
  follows?: number;
  submittedAt: string;
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
};
export type CollectionName = keyof Collections;
