/**
 * サイト全体の基本情報。
 * 名称・連絡先・数値などはここを書き換えると全ページに反映されます。
 */

export const site = {
  /** サービス名 */
  brand: "KITACRE",
  brandKana: "キタクリ",
  serviceName: "KITACRE",
  /** 運営メディア（実績・フォロワー数などはこのメディアのもの） */
  media: "なまらグルメ",
  /** <title> の末尾などに使う名称 */
  title: "KITACRE（キタクリ）｜北海道のグルメインフルエンサーキャスティング",
  tagline: "北海道の食に、発信力を。",
  description:
    "北海道発のクリエイターキャスティングサービス「KITACRE（キタクリ）」。グルメメディア「なまらグルメ」が培ってきた発信力とネットワークを活かし、飲食店・食品メーカー・ホテルのSNSプロモーションを企画から効果報告までワンストップでご提案します。",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  locale: "ja_JP",

  instagram: {
    handle: "@namaragurume",
    url: "https://www.instagram.com/namaragurume/",
    /** DM 画面へのリンク。アプリ・ブラウザによってはプロフィールに遷移します */
    dmUrl: "https://ig.me/m/namaragurume",
  },

  company: {
    name: "株式会社North Pleasure",
    representative: "島田",
    /** 代表者の正式な表記（役職・フルネーム）は公開前に確認 */
    representativeTitle: "代表",
    postalCode: "",
    address: "北海道札幌市中央区南2条西7丁目4-1 2-A",
    media: "なまらグルメ",
    /** 設立年月日：未確認のため空欄。確認後に入力すると会社概要に表示されます */
    founded: "",
    business: [
      "グルメメディア「なまらグルメ」の運営",
      "クリエイターキャスティングサービス「KITACRE」の運営",
      "SNSマーケティング支援",
      "飲食店運営",
    ],
  },

  /** 運営開始 */
  launched: "2021年4月",

  /** 主な対応エリア */
  area: "札幌市を中心に北海道全域（札幌市外はご相談ください）",
} as const;

/**
 * 数字で見るなまらグルメ（トップページ）。運営メディア「なまらグルメ」の数値です。
 * ヒアリング時点の数値です。更新時は value と asOf を変更してください。
 */
export type Stat = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix: string;
  label: string;
  note?: string;
};

export const stats: { asOf: string; items: Stat[] } = {
  /** 例: "2026年10月" と入力すると「※2026年10月時点」と表示されます。空欄なら汎用の注記を表示 */
  asOf: "",
  items: [
    {
      value: 14.2,
      decimals: 1,
      suffix: "万人",
      label: "Instagramフォロワー",
      note: "なまらグルメ公式アカウント（@namaragurume）",
    },
    {
      value: 200,
      suffix: "社超",
      label: "これまでの提案先企業数",
      note: "ご提案を行った企業の数です（契約社数ではありません）",
    },
    {
      prefix: "約",
      value: 50,
      suffix: "人",
      label: "つながりのあるグルメ発信者",
      note: "日頃から連絡を取り合っている発信者の数です",
    },
  ],
};

export type NavItem = { href: string; label: string; en: string };

export const mainNav: NavItem[] = [
  { href: "/service", label: "サービス", en: "SERVICE" },
  { href: "/works", label: "実績", en: "WORKS" },
  { href: "/creators", label: "インフルエンサー", en: "CREATORS" },
  { href: "/pricing", label: "料金", en: "PRICING" },
  { href: "/about", label: "KITACREについて", en: "ABOUT" },
];

export const footerNav: NavItem[] = [
  ...mainNav,
  { href: "/faq", label: "よくある質問", en: "FAQ" },
  { href: "/contact", label: "企業向けお問い合わせ", en: "CONTACT" },
  { href: "/partner", label: "インフルエンサー登録", en: "PARTNER" },
  { href: "/company", label: "運営会社", en: "COMPANY" },
  { href: "/privacy", label: "プライバシーポリシー", en: "PRIVACY" },
];

/**
 * 非公開（published: false）のコンテンツをプレビュー表示するかどうか。
 * ローカル開発、または Vercel のプレビュー環境で CONTENT_PREVIEW=true のときだけ有効。
 */
export const contentPreview =
  process.env.CONTENT_PREVIEW === "true" &&
  process.env.VERCEL_ENV !== "production" &&
  (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview");
