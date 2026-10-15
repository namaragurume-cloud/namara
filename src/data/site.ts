import { siteUrl } from "@/lib/utils";

/**
 * サイト全体の基本情報。
 * 名称・連絡先・数値などはここを書き換えると全ページに反映されます。
 */

export const site = {
  /** サービス名 */
  brand: "MIRATSUMU",
  brandKana: "ミラツム",
  serviceName: "MIRATSUMU",
  /** 運営メディア（実績・フォロワー数などはこのメディアのもの） */
  media: "なまらグルメ",
  /** <title> の末尾などに使う名称 */
  title: "MIRATSUMU",
  /** トップページの <title> */
  homeTitle: "MIRATSUMU｜北海道のインフルエンサーPR・キャスティング",
  tagline: "北海道の食を未来へ紡ぐ。",
  description:
    "北海道のグルメPRならMIRATSUMU。飲食店の集客、新商品PR、認知拡大をサポート。北海道のグルメインフルエンサーを活用し、企画から投稿管理までワンストップで対応。ご予算3万円から相談可能。",
  /** 問い合わせボタンの共通文言 */
  cta: "無料でPRプランを相談する",
  url: siteUrl(),
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
      "クリエイターキャスティングサービス「MIRATSUMU」の運営",
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
 * 運営メディア「なまらグルメ」の Instagram フォロワー数（/about などで表示）。
 * Instagram API を設定すると自動で更新されます。
 */
export const mediaFollowers = { value: 14.2, decimals: 1, suffix: "万人" };

/**
 * 発信者カードと /about にフォロワー数を表示するかどうか。
 * true にすると、手入力の値（または Instagram API で自動取得した値）を表示します。
 * ※トップの「数字で見る MIRATSUMU」（SNS総フォロワー数）はこの設定に関係なく表示されます。
 */
export const showFollowerCounts = false;

/**
 * 数字で見る「MIRATSUMU」（トップページ）。
 * 更新時は value と asOf を変更してください。
 */
export type Stat = {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix: string;
  label: string;
  note?: string;
};

export const stats: { asOf: string; items: Stat[]; footnote?: string } = {
  /** 例: "2026年10月" と入力すると「※2026年10月時点」と表示されます。空欄なら汎用の注記を表示 */
  asOf: "",
  items: [
    {
      value: 115,
      suffix: "万人超",
      label: "MIRATSUMUの発信者たちのSNS総フォロワー数",
    },
    {
      value: 1000,
      suffix: "店舗超",
      label: "発信者たちがこれまでにPRしてきた店舗数",
    },
    {
      value: 200,
      suffix: "%UP",
      label: "発信者のPRで実現した売上アップの事例",
      note: "ある飲食店の月間売上（200万円→PR実施後600万円）",
    },
  ],
  footnote: "売上の成果は、PR以外の要因を含む場合があります。",
};

export type NavItem = { href: string; label: string; en: string };

export const mainNav: NavItem[] = [
  { href: "/service", label: "サービス", en: "SERVICE" },
  { href: "/works", label: "発信者の実績", en: "WORKS" },
  { href: "/creators", label: "インフルエンサー", en: "CREATORS" },
  { href: "/pricing", label: "料金", en: "PRICING" },
  { href: "/about", label: "MIRATSUMUについて", en: "ABOUT" },
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
