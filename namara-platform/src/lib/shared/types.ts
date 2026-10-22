/**
 * なまらAI と NAMARA REVIEW が共有するドメイン型。
 * 共通の store_id（Store.id）で検索結果と店舗管理画面を紐づける。
 */
import type { AreaId, BudgetBandId, City, FeatureId, GenreId, SceneId } from "./dictionaries";

/** 1人あたりの価格帯（円）。確認できない場合は null */
export type PriceRange = { min: number; max: number };

export type StorePhoto = {
  url: string;
  /** 出典表記（必須）。利用許可のない写真は登録しない */
  credit: string;
  license: "owner_provided" | "namara_original" | "google_places";
};

export type Store = {
  id: string;
  name: string;
  /** サンプル（架空）店舗かどうか。true の店舗は画面に「架空」と明示する */
  isSample: boolean;
  /** 公開フラグ。運営が検証するまで false */
  published: boolean;
  areaId: AreaId;
  city: City;
  address: string;
  genreIds: GenreId[];
  scenes: SceneId[];
  features: FeatureId[];
  /** 店舗のこだわり・特徴（自由キーワード検索用） */
  tags: string[];
  budget: {
    lunch: PriceRange | null;
    dinner: PriceRange | null;
    /** 予算目安の根拠（例：店舗提供メニュー表 2026-09 時点）。不明なら null */
    basis: string | null;
  };
  /** 営業時間。確認できない場合は null（画面では「不明」） */
  hours: string | null;
  reservationUrl: string | null;
  /** 店舗公式サイト等。架空店舗は null */
  websiteUrl: string | null;
  photo: StorePhoto | null;
  location: { lat: number; lng: number; approximate: boolean };
  verification: {
    status: "verified" | "unverified";
    /** 運営が最後に情報を確認した日（YYYY-MM-DD） */
    verifiedAt: string | null;
    source: "sample" | "owner" | "operator" | "google_places";
  };
  organizationId: string | null;
  updatedAt: string;
};

export type MealTime = "lunch" | "dinner";

export type BudgetCondition = {
  /** 1人あたり上限（円） */
  max: number | null;
  /** 1人あたり下限（円） */
  min: number | null;
  /** 「予算8000円」のような目安。上限は目安の +20% まで許容する */
  target: number | null;
  /** 「以内」「まで」と明示されたときは true（上限を厳守） */
  strict: boolean;
};

/** 自然文から抽出した検索条件（正規化済み） */
export type SearchConditions = {
  areaIds: AreaId[];
  cities: City[];
  genreIds: GenreId[];
  budget: BudgetCondition | null;
  mealTime: MealTime | null;
  scenes: SceneId[];
  features: FeatureId[];
  partySize: number | null;
  /** 日付・時間の表現（空席確認はしない。参考表示のみ） */
  dateText: string | null;
  timeText: string | null;
  /** 辞書に無いその他の希望（例：夜景、地酒） */
  keywords: string[];
};

export type ParseResult = {
  conditions: SearchConditions;
  /** 解析に使った方式。mock_rule は辞書ベース、openai は将来の LLM 解析 */
  parser: "rule" | "openai";
  /** 解析できなかった・あいまいな点（UI でやさしく案内する） */
  notes: string[];
};

export type ScoreReason = {
  code:
    | "genre_exact"
    | "genre_related"
    | "area_exact"
    | "city_match"
    | "budget_fit"
    | "budget_near"
    | "scene_match"
    | "feature_match"
    | "keyword_match"
    | "fresh_info"
    | "stale_info"
    | "no_condition";
  label: string;
  points: number;
};

export type RecommendedStore = {
  store: Store;
  rank: number;
  score: number;
  reasons: ScoreReason[];
  /** 表示用：予算目安（例：「4,000〜6,000円（夜）」）と根拠 */
  budgetText: string;
  budgetBasis: string;
  warnings: string[];
};

export type SponsoredSlot = {
  campaignId: string;
  impressionId: string;
  store: Store;
  budgetText: string;
  matchReasons: string[];
};

export type SearchOutcome = {
  searchId: string;
  parse: ParseResult;
  results: RecommendedStore[];
  sponsored: SponsoredSlot | null;
  /** 0件・少数件のときの言い換え提案（条件を勝手に緩めて表示はしない） */
  suggestions: string[];
  totalCandidates: number;
};

/* ------------------------------ イベント計測 ------------------------------ */

export const INTERACTION_EVENT_TYPES = [
  "search_submitted",
  "search_parsed",
  "recommendation_shown",
  "store_detail_clicked",
  "map_clicked",
  "reservation_link_clicked",
  "store_saved",
  "search_refined",
  "no_result",
] as const;

export type InteractionEventType = (typeof INTERACTION_EVENT_TYPES)[number];

export type Channel = "web" | "line";

export type InteractionEvent = {
  id: string;
  /** 重複排除用のキー（クライアント生成 or サーバー生成） */
  dedupeKey: string;
  type: InteractionEventType;
  channel: Channel;
  /** 仮名化したセッションID（個人を直接特定しない） */
  sessionId: string;
  searchId: string | null;
  storeId: string | null;
  position: number | null;
  sponsored: boolean;
  createdAt: string;
};

/** 店舗向け統計の元になる「個人情報を含まない」検索ログ */
export type SearchLog = {
  id: string;
  sessionId: string;
  channel: Channel;
  /** 生の入力文。保存期間（既定90日）を過ぎたら削除。店舗には提供しない */
  rawText: string | null;
  conditions: SearchConditions;
  budgetBand: BudgetBandId | null;
  resultCount: number;
  shownStoreIds: string[];
  createdAt: string;
  /** デモ用の合成データかどうか（実測値と区別する） */
  synthetic: boolean;
};

/* ------------------------------ 広告 ------------------------------ */

export type CampaignStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "paused"
  | "stopped"
  | "budget_exhausted";

export type Campaign = {
  id: string;
  storeId: string;
  organizationId: string;
  name: string;
  targeting: { areaIds: AreaId[]; genreIds: GenreId[] };
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  /** 期間の広告予算（円） */
  budgetYen: number;
  /** 1クリックあたりの課金額（円）。モック設定 */
  cpcYen: number;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdImpression = {
  id: string;
  campaignId: string;
  storeId: string;
  searchId: string;
  sessionId: string;
  createdAt: string;
};

export type AdClick = {
  id: string;
  impressionId: string;
  campaignId: string;
  storeId: string;
  sessionId: string;
  createdAt: string;
  /** 不正・重複と判定したクリックは課金しない */
  valid: boolean;
  invalidReason: "duplicate" | "rate_limited" | "unknown_impression" | "expired_impression" | "budget_exhausted" | null;
};

/** 課金計算イベント（表示イベントとは別に記録する） */
export type AdBillingEvent = {
  id: string;
  campaignId: string;
  clickId: string;
  amountYen: number;
  createdAt: string;
};

/* ------------------------------ 口コミ・アンケート（モック） ------------------------------ */

export type Review = {
  id: string;
  storeId: string;
  source: "google_mock";
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  authorLabel: string;
  createdAt: string;
  reply: { text: string; publishedAt: string } | null;
  draft: { text: string; status: "ai_draft" | "approved" } | null;
};
