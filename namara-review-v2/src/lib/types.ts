/**
 * NAMARA REVIEW のドメイン型。
 * Phase 2 で Supabase のテーブル（docs/ARCHITECTURE.md）に対応させる前提で、
 * フィールド名はテーブル列と揃えている。
 */

export type Role = "owner" | "manager" | "staff";

export type Tone = "polite" | "friendly" | "casual";

export type Topic = "food" | "service" | "price" | "atmosphere" | "speed" | "cleanliness";

export type Sentiment = "positive" | "negative";

/**
 * 口コミの返信ステータス。
 * unreplied → draft → pending（承認待ち）→ publishing → published / failed
 */
export type ReplyStatus = "unreplied" | "draft" | "pending" | "publishing" | "published" | "failed";

export type IntegrationStatus = "connected" | "not_connected" | "error";

export type PlanId = "starter" | "standard" | "premium";

export interface Organization {
  id: string;
  name: string;
  plan: PlanId;
}

export interface ReplyPolicy {
  tone: Tone;
  /** 返信の最後に付ける署名（例: 店長 山田） */
  signature: string;
  /** AIに守らせる店舗独自ルール（1行1ルール） */
  rules: string[];
  /** 返信に含めてはいけない語句 */
  ngWords: string[];
  /** 低評価（★1〜2）への返信方針 */
  lowRatingGuidance: string;
  /** 返信の目安文字数 */
  maxLength: number;
}

export interface NotificationSettings {
  lineNewReview: boolean;
  lineLowRatingOnly: boolean;
  lowRatingThreshold: 1 | 2 | 3;
  lineDraftReady: boolean;
  linePublishResult: boolean;
  emailWeeklyReport: boolean;
}

export interface Store {
  id: string;
  organizationId: string;
  name: string;
  shortName: string;
  genre: string;
  area: string;
  address: string;
  phone: string;
  hours: string;
  googleStatus: IntegrationStatus;
  googleLocationName: string | null;
  googleLastSyncedAt: string | null;
  lineStatus: IntegrationStatus;
  policy: ReplyPolicy;
  notifications: NotificationSettings;
}

export interface ReviewTopic {
  topic: Topic;
  sentiment: Sentiment;
  /** 口コミ中の具体的な言及（例: 上タン塩）。返信で言及するために使う */
  keyword?: string;
}

export interface Review {
  id: string;
  storeId: string;
  /** Google上の口コミID（重複取り込み防止のユニークキー） */
  googleReviewId: string;
  author: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  createdAt: string;
  topics: ReviewTopic[];
  status: ReplyStatus;
  /** Googleに公開済みの返信 */
  publishedReply: { text: string; publishedAt: string } | null;
}

export interface ReplyDraft {
  id: string;
  reviewId: string;
  text: string;
  tone: Tone;
  source: "ai" | "edited";
  /** 編集のたびに増える。投稿の冪等キーに使う */
  version: number;
  updatedAt: string;
  updatedBy: string;
  submittedAt: string | null;
  submittedBy: string | null;
}

export interface ReplyPublication {
  id: string;
  reviewId: string;
  draftId: string;
  /** reviewId + draft version。同じキーで成功済みなら再投稿しない */
  idempotencyKey: string;
  status: "success" | "failed";
  attempt: number;
  attemptedAt: string;
  actor: string;
  text: string;
  error: string | null;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** 担当店舗。owner は全店舗 */
  storeIds: string[];
  lineLinked: boolean;
  lastActiveAt: string;
  invited?: boolean;
}

export interface AuditLog {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
}
