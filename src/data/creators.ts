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
 *
 * フォロワー数：
 *   Instagram API（README「フォロワー数の自動取得」）を設定すると、プロアカウント
 *   （ビジネス／クリエイター）のフォロワー数が自動で反映されます。
 *   取得できない場合は followers に入力した数値を表示し、空なら非表示にします。
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
  /** フォロワー数（手入力の値。自動取得できた場合はそちらを優先） */
  followers?: number;
  /** フォロワー数の確認日（例: "2026年10月"） */
  followersAsOf?: string;
  /** 得意ジャンル（未確認なら空のまま） */
  genres: CreatorGenre[];
  /** 活動エリア（未確認なら空のまま） */
  areas: CreatorArea[];
  /** 投稿事例（掲載許可済みのもののみ） */
  examples?: { title: string; url: string }[];
  published: boolean;
};

export const creators: Creator[] = [
  {
    id: "namaragurume",
    account: "namaragurume",
    name: "なまらグルメ【北海道グルメ】",
    image: "/images/creators/namaragurume.jpg",
    platform: "Instagram",
    profileUrl: "https://www.instagram.com/namaragurume/",
    followers: 142000,
    genres: [],
    areas: [],
    published: true,
  },
  {
    id: "kenji-gourmet",
    account: "kenji_gourmet_1987",
    name: "けんじ グルメマン",
    image: "/images/creators/kenji-gourmet.jpg",
    platform: "Instagram",
    profileUrl: "https://www.instagram.com/kenji_gourmet_1987/",
    genres: [],
    areas: [],
    published: true,
  },
  {
    id: "kitagohan",
    account: "kitagohan_insta",
    name: "きたごはん🍽️ 札幌グルメ スポット",
    image: "/images/creators/kitagohan.jpg",
    platform: "Instagram",
    profileUrl: "https://www.instagram.com/kitagohan_insta/",
    genres: [],
    areas: [],
    published: true,
  },
  {
    id: "oniyan",
    account: "oniyan_grm",
    name: "おにやん｜北海道グルメ・カフェ",
    image: "/images/creators/oniyan.jpg",
    platform: "Instagram",
    profileUrl: "https://www.instagram.com/oniyan_grm/",
    genres: [],
    areas: [],
    published: true,
  },
  {
    id: "rikomogu",
    account: "riko_mogram",
    name: "りこモグ【札幌グルメ/ 北海道グルメ】",
    image: "/images/creators/rikomogu.jpg",
    platform: "Instagram",
    profileUrl: "https://www.instagram.com/riko_mogram/",
    genres: [],
    areas: [],
    published: true,
  },
  {
    id: "yana",
    account: "___yana_official",
    name: "やなちゃん〻札幌グルメスポット紹介",
    image: "/images/creators/yana.jpg",
    platform: "Instagram",
    profileUrl: "https://www.instagram.com/___yana_official/",
    genres: [],
    areas: [],
    published: true,
  },
  {
    id: "iori",
    account: "iori_hokkaido_",
    name: "イオリ｜札幌グルメ・北海道グルメ",
    image: "/images/creators/iori.jpg",
    platform: "Instagram",
    profileUrl: "https://www.instagram.com/iori_hokkaido_/",
    genres: [],
    areas: [],
    published: true,
  },
  {
    id: "shiro-gourmet",
    account: "shiro.gourmet",
    name: "しろグルメ｜札幌グルメ｜北海道グルメ観光",
    image: "/images/creators/shiro-gourmet.jpg",
    platform: "Instagram",
    profileUrl: "https://www.instagram.com/shiro.gourmet/",
    genres: [],
    areas: [],
    published: true,
  },
  {
    id: "poroguru",
    account: "sappo_ro_gurume",
    name: "ぽろグル【札幌グルメ/北海道グルメ】",
    image: "/images/creators/poroguru.jpg",
    platform: "Instagram",
    profileUrl: "https://www.instagram.com/sappo_ro_gurume/",
    genres: [],
    areas: [],
    published: true,
  },
  {
    id: "kitasala-gourmet",
    account: "kitasala_gourmet",
    name: "北に飛ばさらリーマングルメ|北海道グルメ",
    image: "/images/creators/kitasala-gourmet.jpg",
    platform: "Instagram",
    profileUrl: "https://www.instagram.com/kitasala_gourmet/",
    genres: [],
    areas: [],
    published: true,
  },
  {
    id: "rui",
    account: "rui.hokkaido",
    name: "るい【ぼっち食べ歩き】",
    image: "/images/creators/rui.jpg",
    platform: "Instagram",
    profileUrl: "https://www.instagram.com/rui.hokkaido/",
    genres: [],
    areas: [],
    published: true,
  },
];

export function getCreatorById(id: string | undefined): Creator | undefined {
  return id ? creators.find((c) => c.id === id && (c.published || contentPreview)) : undefined;
}

export function getVisibleCreators(): Creator[] {
  return creators.filter((c) => c.published || contentPreview);
}

/** 表示用：フォロワー数が自動取得できたかどうかを含む */
export type CreatorView = Creator & { followersLive?: boolean };

export function formatFollowers(n: number): string {
  if (n >= 10000) {
    const man = n / 10000;
    return `${Math.floor(man * 10) / 10}万`;
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
