import { images, type SiteImage } from "./images";

export type Reason = {
  no: string;
  /** 短いラベル */
  label: string;
  title: string;
  body: string;
  image: SiteImage;
  link?: { href: string; label: string };
};

/** MIRATSUMUが選ばれる理由（北海道の食材・店舗・発信者をつなぐ3つの強み） */
export const reasons: Reason[] = [
  {
    no: "01",
    label: "NETWORK",
    title: "北海道グルメに特化した発信者ネットワーク",
    body: "札幌を中心に、北海道の食に強いグルメインフルエンサーと連携しています。フォロワー数だけでなく、得意なジャンルや視聴者層、PRの目的を踏まえて、店舗や商品に合う発信者をご提案します。",
    image: images.reason3,
    link: { href: "/creators", label: "インフルエンサーを見る" },
  },
  {
    no: "02",
    label: "MEDIA",
    title: "グルメメディア「なまらグルメ」の発信実績",
    body: "2021年から北海道のグルメメディア「なまらグルメ」を運営し、生産者さんや飲食店へ足を運んで発信を続けてきました。ユーザーが思わず保存したくなる伝え方や、投稿の企画づくりを熟知しています。",
    image: images.reason1,
    link: { href: "/about#activities", label: "これまでの活動を見る" },
  },
  {
    no: "03",
    label: "ON SITE",
    title: "飲食店の現場を理解しているから、寄り添える",
    body: "自社でも飲食店を運営しています。SNS上の再生数だけでなく、店舗側が抱える集客の悩みや、オペレーションの事情まで踏まえた企画をご提案します。",
    image: images.reason2,
  },
];
