import { contentPreview } from "./site";

/**
 * 掲載するインフルエンサー（発信者）の一覧。
 *
 * 【重要】実在する発信者は、本人から掲載許可（名前・写真・投稿事例）を
 * 取得したうえで published: true にしてください。
 * published: false のデータは公開サイトには表示されません。
 *
 * 追加方法：
 *   1. プロフィール画像を public/images/creators/ に置く（例: sample.jpg）
 *   2. 下の配列に項目を追加し、image に "/images/creators/sample.jpg" を記入
 *   3. 掲載許可を確認したら published: true
 */

export type CreatorArea = "札幌" | "道央" | "道南" | "道北" | "道東" | "北海道全域";
export type CreatorGenre =
  | "ラーメン"
  | "カフェ・スイーツ"
  | "焼肉・ジンギスカン"
  | "居酒屋"
  | "海鮮・寿司"
  | "その他";

export type Creator = {
  /** URLや識別に使うID（半角英数字） */
  id: string;
  /** アカウント名（@なし） */
  account: string;
  /** 活動名（任意） */
  name?: string;
  /** プロフィール画像のパス */
  image?: string;
  platform: "Instagram" | "TikTok";
  profileUrl: string;
  /** フォロワー数（数値） */
  followers: number;
  /** フォロワー数の確認日（例: "2026年10月"） */
  followersAsOf?: string;
  genres: CreatorGenre[];
  areas: CreatorArea[];
  /** 投稿事例（掲載許可済みのもののみ） */
  examples?: { title: string; url: string }[];
  published: boolean;
};

export const creators: Creator[] = [
  // ↓ レイアウト確認用のサンプル（架空・非公開）。実データ追加後に削除してください。
  {
    id: "sample",
    account: "sample_account",
    name: "サンプル（架空・非公開）",
    platform: "Instagram",
    profileUrl: "https://www.instagram.com/",
    followers: 12000,
    genres: ["ラーメン", "居酒屋"],
    areas: ["札幌"],
    examples: [],
    published: false,
  },
];

export function getVisibleCreators(): Creator[] {
  return creators.filter((c) => c.published || contentPreview);
}

export function formatFollowers(n: number): string {
  if (n >= 10000) {
    const man = n / 10000;
    return `${man >= 10 ? Math.round(man) : Math.round(man * 10) / 10}万`;
  }
  return n.toLocaleString("ja-JP");
}

/** フォロワー規模の区分（絞り込み用） */
export const followerScales = [
  { id: "u10k", label: "1万人未満", min: 0, max: 9999 },
  { id: "10-30k", label: "1万〜3万人", min: 10000, max: 29999 },
  { id: "30-50k", label: "3万〜5万人", min: 30000, max: 49999 },
  { id: "50-100k", label: "5万〜10万人", min: 50000, max: 99999 },
  { id: "100k", label: "10万人以上", min: 100000, max: Infinity },
] as const;
