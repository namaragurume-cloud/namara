import { images, type SiteImage } from "./images";

export type Reason = { no: string; title: string; body: string; image: SiteImage };

export const reasons: Reason[] = [
  {
    no: "01",
    title: "北海道のグルメに特化した専門性",
    body: "グルメメディア「なまらグルメ」として、北海道各地の生産者さんや飲食店へ足を運び、食の魅力を発信し続けてきた経験をもとに、地域性や飲食業界の特性を理解したPRをご提案します。",
    image: images.reason1,
  },
  {
    no: "02",
    title: "飲食店を運営しているからこその現場目線",
    body: "自社でも飲食店を運営。SNS上の再生数だけでなく、店舗側が求める集客や売上を意識した施策を考えます。",
    image: images.reason2,
  },
  {
    no: "03",
    title: "約50人の発信者とのネットワーク",
    body: "フォロワー10万人超の大型インフルエンサーから、地域密着型のマイクロインフルエンサーまで、発信者と直接コミュニケーションを取っています。",
    image: images.reason3,
  },
  {
    no: "04",
    title: "予算に合わせた柔軟な提案",
    body: "大型インフルエンサー1名の起用から、複数のマイクロインフルエンサーを組み合わせた企画まで。目的や予算に合わせて最適な組み合わせを提案します。",
    image: images.reason4,
  },
  {
    no: "05",
    title: "企画から効果報告まで一括対応",
    body: "PR企画、キャスティング、投稿管理、効果レポートまで一貫してサポートします。",
    image: images.reason5,
  },
];
