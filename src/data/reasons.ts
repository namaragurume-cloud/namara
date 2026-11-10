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

/** MIRATSUMUが選ばれる理由（自ら発信者・独自の発信者ネットワーク・飲食店経営の3つの強み） */
export const reasons: Reason[] = [
  {
    no: "01",
    label: "CREATOR",
    title: "自らも発信者。グルメメディア「なまらグルメ」を運営",
    body: "MIRATSUMUを運営するのは、北海道のグルメメディア「なまらグルメ」。2021年から生産者さんや飲食店へ自ら足を運び、発信を続けてきた現役の発信者です。どんな投稿が保存され、来店につながるのかを、自らの発信を通して熟知しています。",
    image: images.reason1,
    link: { href: "/about#activities", label: "これまでの活動を見る" },
  },
  {
    no: "02",
    label: "NETWORK",
    title: "MIRATSUMUにだけ所属する発信者とのつながり",
    body: "北海道グルメに強いインフルエンサーと、独自のつながりを築いてきました。MIRATSUMUにだけ所属する発信者も含め、ここでしか依頼できない内容をご提案します。",
    image: images.reason3,
    link: { href: "/creators", label: "インフルエンサーを見る" },
  },
  {
    no: "03",
    label: "RESTAURANT",
    title: "自ら飲食店を経営。お店側の目線で企画する",
    body: "自社でも飲食店を経営しています。SNS上の再生数だけでなく、集客の悩みや営業中のオペレーションまで、お店を経営する側の目線で踏まえて企画をご提案します。",
    image: images.reason2,
  },
];
