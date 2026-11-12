/**
 * 株式会社North Pleasure コーポレートサイトの内容（/corp）。
 *
 * - 会社情報（社名・代表・所在地）は site.company を共用しています。
 * - 未確認の情報（URL・営業時間など）は空欄にしてください。空欄の項目は表示されません。
 * - 独自ドメインを取得したら、proxy でそのドメインのアクセスを /corp に振り分けます（README 参照）。
 */

import { site } from "./site";

export const corp = {
  name: site.company.name,
  nameEn: "North Pleasure Inc.",
  /** トップの大見出し（案。確定したら差し替え） */
  message: { lead: "北海道の食を、", accent: "もっと楽しく。" },
  intro:
    "株式会社North Pleasureは、北海道の食の魅力を「発信する」「届ける」「味わってもらう」の3つの事業で広げています。グルメメディアの発信力と、飲食店の現場で培った知見を掛け合わせ、北海道の食に関わる人たちの想いを全国へ届けます。",
};

export type CorpService = {
  name: string;
  description: string;
  /** 外部サイトなど。空欄ならリンクを表示しない */
  href?: string;
  linkLabel?: string;
};

export type CorpBusiness = {
  id: string;
  no: string;
  en: string;
  title: string;
  lead: string;
  image: { src: string; alt: string; position?: string };
  services: CorpService[];
};

export const businesses: CorpBusiness[] = [
  {
    id: "sns",
    no: "01",
    en: "SNS",
    title: "SNS事業",
    lead: "2021年から運営するグルメメディア「なまらグルメ」と、北海道グルメに強い発信者をつなぐキャスティングサービス「MIRATSUMU」で、飲食店や食品メーカーのPRを支援しています。",
    image: { src: "/images/reasons/media.jpg", alt: "スマートフォンに表示された、なまらグルメのロゴ", position: "50% 37%" },
    services: [
      {
        name: "なまらグルメ",
        description: "北海道のグルメを発信するInstagramメディア。生産者さんや飲食店へ足を運び、北海道の食の魅力を届けています。",
        href: site.instagram.url,
        linkLabel: `Instagram ${site.instagram.handle}`,
      },
      {
        name: "MIRATSUMU（ミラツム）",
        description: "北海道のグルメインフルエンサーPR・キャスティングサービス。企画から発信者の選定、投稿管理、効果報告までワンストップで対応します。",
        href: "/",
        linkLabel: "MIRATSUMUのサイトへ",
      },
    ],
  },
  {
    id: "ec",
    no: "02",
    en: "E-COMMERCE",
    title: "EC事業",
    lead: "北海道の食の魅力を、全国のご家庭へ。ECサイト「なまらHOKKAIDO」を運営しています。",
    image: { src: "/images/activities/tokachi-potato.jpg", alt: "十勝の畑で収穫されたじゃがいも" },
    services: [
      {
        name: "なまらHOKKAIDO",
        description: "北海道の食を届けるECサイト。",
        // TODO: ECサイトのURLを受け取ったら入力
        href: "",
        linkLabel: "なまらHOKKAIDOへ",
      },
    ],
  },
  {
    id: "restaurant",
    no: "03",
    en: "RESTAURANT",
    title: "飲食店事業",
    lead: "2026年4月、札幌・すすきのに自社店舗「薄野まぜそば 三鳥目の夕日」をオープン。飲食店を経営する立場から、お店側の目線でSNSの企画にも活かしています。",
    image: { src: "/images/reasons/own-restaurant-front.jpg", alt: "自社運営店舗「薄野まぜそば 三鳥目の夕日」の店構え", position: "50% 65%" },
    services: [
      {
        name: "薄野まぜそば 三鳥目の夕日",
        description: "札幌・すすきののまぜそば店。",
        // TODO: 店舗の Instagram・予約サイトなどのURLを受け取ったら入力
        href: "",
        linkLabel: "店舗情報を見る",
      },
    ],
  },
];

/** 会社概要（空欄の行は表示しない） */
export const corpProfile: { label: string; value: string }[] = [
  { label: "会社名", value: `${site.company.name}（${"North Pleasure Inc."}）` },
  { label: "代表", value: site.company.representative },
  { label: "所在地", value: [site.company.postalCode && `〒${site.company.postalCode}`, site.company.address].filter(Boolean).join(" ") },
  { label: "設立", value: site.company.founded },
  {
    label: "事業内容",
    value: [
      "SNS事業（グルメメディア「なまらグルメ」、インフルエンサーキャスティング「MIRATSUMU」）",
      "EC事業（「なまらHOKKAIDO」）",
      "飲食店事業（「薄野まぜそば 三鳥目の夕日」）",
    ].join("\n"),
  },
];

export const corpNav = [
  { href: "/corp#business", label: "事業内容" },
  { href: "/corp#history", label: "沿革" },
  { href: "/corp#company", label: "会社概要" },
  { href: "/corp/contact", label: "お問い合わせ" },
];
