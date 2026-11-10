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
  /** ホームページからフォロワー数を取り込んだ日時（アカウント名が同じ発信者と連動） */
  followersSyncedAt?: string;
  /** SNSのプロフィールURL（空ならSNSとアカウントから自動で作る） */
  profileUrl?: string;
  /** アイコン画像を保存した日時（あればアイコンあり。URLのキャッシュ更新にも使う） */
  iconAt?: string;
  /** 飲食店への提案に使う料金（1投稿・税別・円） */
  price?: number;
  active: boolean;
  createdAt: string;
};

export type Restaurant = {
  id: string;
  name: string;
  /** 公式LINEと連携済みの場合の LINE userId（個人で連携） */
  lineUserId?: string;
  /** お店のLINEグループと連携した場合のグループID（こちらが優先。グループ全員に届く） */
  lineGroupId?: string;
  /** 公式LINEに送ってもらう連携コード */
  lineLinkCode?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  /** 食べログのページ */
  tabelogUrl?: string;
  /** お店のInstagram */
  instagramUrl?: string;
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

/** 期間と時間帯から選んでもらう場合の設定 */
export type FlexSchedule = {
  /** 期間 YYYY-MM-DD */
  from: string;
  to: string;
  /** 撮影できる曜日（0=日〜6=土） */
  weekdays: number[];
  /** 時間帯 HH:mm（この時間の中で撮影が終わる開始時刻を選べる） */
  start: string;
  end: string;
  /** 1回の撮影の長さ（分） */
  durationMin: number;
  /** 開始時刻の刻み（分） */
  stepMin: number;
  /** 同じ時間にお店に入れる人数（同伴者を含む） */
  capacity: number;
  /** 撮影できない日 */
  exclude: string[];
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
  /** 日時の決め方：fixed＝候補日を決める（既定）／flex＝期間と時間帯から発信者が希望日時を選ぶ */
  scheduling?: "fixed" | "flex";
  flex?: FlexSchedule;
  /** 回答期限 YYYY-MM-DD */
  replyDeadline: string;
  /** 投稿日の候補 YYYY-MM-DD（発信者はこの中から選ぶ） */
  postDates?: string[];
  /** 最後の投稿日（postDates から自動。古い案件では投稿期限） */
  postDeadline: string;
  /** 飲食店向けページ（/p/[token]）のトークン */
  shareToken: string;
  scheduleSharedAt?: string;
  /** この案件のもとになった提案 */
  proposalId?: string;
  /** 飲食店ページで撮影・投稿の状況をリアルタイムに公開する */
  liveShare?: boolean;
  /** 投稿前の動画チェック：なし／飲食店が直接確認／あなたが先に確認してから飲食店へ */
  videoCheck?: "none" | "direct" | "owner_first";
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

export type VideoDecision = { status: "ok" | "ng"; comment?: string; at: string; by?: "shop" | "admin"; /** 確認した人の名前（お店のページで入力・任意） */ name?: string };

/** 発信者が送った動画（1回の提出＝1件） */
export type VideoVersion = {
  id: string;
  /** 再生用のURL（Vercel Blob の公開URL、またはローカル保存の配信URL） */
  url: string;
  /** 保存先での識別子（削除に使う） */
  storageKey: string;
  storage: "blob" | "local" | "demo";
  size: number;
  contentType: string;
  uploadedAt: string;
  /** あなたのチェック（「先に確認」の案件のみ） */
  owner?: VideoDecision;
  /** 飲食店の確認 */
  shop?: VideoDecision;
  sentToShopAt?: string;
  /** 投稿後に動画ファイルを削除した日時 */
  fileDeletedAt?: string;
};

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
  /** 確定・日程変更の連絡に添えた、あなたからのひとこと */
  confirmNote?: string;
  /** 投稿予定日 YYYY-MM-DD */
  plannedPostDate?: string;
  /** 投稿日は本人に入力してもらう（実施済みの案件として記録し、投稿日を空にしたとき） */
  postDateByCreator?: boolean;
  /** この人だけの報酬・特典（空なら案件の共通の報酬） */
  offer?: string;
  /** 来店人数（本人を含む。1＝本人のみ、2＝同伴1名） */
  partySize?: number;
  note?: string;
  respondedAt?: string;
  confirmedNotifiedAt?: string;
  /** 一度連絡した撮影日時・投稿日（変更・再調整の連絡で「変更前」として使う） */
  previousSlotId?: string;
  previousPostDate?: string;
  /** 確定後に日程を変更して連絡した日時（お店への再共有の目安） */
  scheduleChangedAt?: string;
  /** 見送りの人にもう一度依頼した日時とひとこと */
  reRequestedAt?: string;
  reRequestNote?: string;
  /** 日程の再調整（選び直し）をお願いした日時と理由 */
  rescheduleRequestedAt?: string;
  rescheduleReason?: string;
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
  /** 投稿前チェック用の動画（新しいものが最後） */
  videos?: VideoVersion[];
  videoRequestedAt?: string;
  videoShopRemindedAt?: string;
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

/** 管理画面で編集したメッセージの文面（id はテンプレートの種類） */
export type TemplateOverride = {
  id: string;
  subject?: string;
  body: string;
  updatedAt: string;
};

/** 提案の共通設定（料金の計算・資料の備考） */
export type ProposalSettings = {
  id: "proposal";
  /** 消費税率（%） */
  taxRate: number;
  /** ディレクション費など、提案ごとに加える固定費（税別・円。0なら載せない） */
  directionFee: number;
  directionFeeLabel: string;
  /** 提案の有効期限（日数） */
  validDays: number;
  /** 料金の下に載せる共通の備考（例：二次利用は別途ご相談） */
  notes: string;
};

/** 料金表の見出しとライトプラン（あなたが編集） */
export type ProposalText = {
  /** 料金表のタイトル（空なら「〇〇様 SNSプロモーション 料金のご案内」） */
  title?: string;
  /** 人数を絞ったプランも載せる場合の発信者と説明 */
  lightPlan?: { creatorIds: string[]; reason?: string };
};

/** 飲食店への提案 */
export type Proposal = {
  id: string;
  restaurantId: string;
  creatorIds: string[];
  /** あなたのメモ（提案の狙い・お店の要望など。お店には見えません） */
  request?: string;
  text?: ProposalText;
  shareToken: string;
  sentAt?: string;
  campaignId?: string;
  createdAt: string;
  updatedAt?: string;
};

export type Collections = {
  creators: Creator;
  restaurants: Restaurant;
  campaigns: Campaign;
  assignments: Assignment;
  messages: MessageLog;
  shots: Shot;
  templates: TemplateOverride;
  settings: ProposalSettings;
  proposals: Proposal;
};
export type CollectionName = keyof Collections;
