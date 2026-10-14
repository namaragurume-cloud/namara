/**
 * サイトで使用する画像の一覧。
 *
 * 実際の写真を使う場合：
 *   1. public/images/ 以下に画像を置く（例: public/images/food/hero.jpg）
 *   2. 該当項目の src に "/images/food/hero.jpg" のように記入
 *   3. alt（画像の説明）を実際の内容に合わせて修正
 *
 * src が空の項目は「仮素材」としてグラデーションのプレースホルダーを表示します。
 * 掲載許可を得た画像のみ使用してください。
 */

export type SiteImage = {
  src?: string;
  alt: string;
  /** 表示位置（CSS object-position。例: "50% 30%"） */
  position?: string;
  /** src が空のときにプレースホルダーに表示するラベル */
  placeholder: string;
};

export const images = {
  heroShooting: {
    src: "/images/activities/akkeshi-oyster.jpg",
    alt: "厚岸町の牡蠣漁に同行し、水揚げした牡蠣を手にする様子",
    placeholder: "現場取材",
  },
  aboutMain: {
    src: "/images/activities/deer-hunting.jpg",
    alt: "朝日の差し込む森で、エゾシカ猟に同行する様子",
    placeholder: "なまらグルメ活動写真",
    position: "100% 50%",
  },
  aboutSub: {
    src: "/images/activities/tokachi-potato.jpg",
    alt: "十勝の生産者さんを訪ね、じゃがいもを手にする様子",
    placeholder: "北海道の食材写真",
  },
  aboutMedia: {
    src: "/images/activities/tokachi-meeting.jpg",
    alt: "十勝の生産者さんを訪ね、お話を伺う様子",
    placeholder: "なまらグルメ活動写真",
  },
  reason1: { src: "/images/activities/akkeshi-oyster.jpg", alt: "厚岸町の牡蠣漁の現場", placeholder: "北海道グルメ", position: "50% 30%" },
  reason2: { src: "/images/activities/autumnfest-2024.jpg", alt: "オータムフェストでの店舗運営", placeholder: "店舗運営", position: "50% 55%" },
  reason3: { src: "/images/activities/tokachi-garlic.jpg", alt: "生産者さんとの交流", placeholder: "ネットワーク" },
  reason4: { src: "/images/activities/tokachi-meeting.jpg", alt: "打ち合わせの様子", placeholder: "企画提案" },
  reason5: { src: "/images/activities/sapporo-classic.jpg", alt: "企業の企画・イベントの広報を担当", placeholder: "企画・広報" },
  serviceHero: {
    src: "/images/activities/tokachi-farm.jpg",
    alt: "十勝の生産者さんの農場を訪ねた様子",
    placeholder: "撮影・PR実施風景",
    position: "50% 60%",
  },
  founder: {
    src: "/images/activities/nanporo-corn.jpg",
    alt: "なまらグルメ 運営者 島田",
    placeholder: "運営者写真",
  },
  partnerHero: {
    src: "/images/activities/australia-field.jpg",
    alt: "現地の生産者と",
    placeholder: "発信者の撮影風景",
    position: "50% 60%",
  },
} satisfies Record<string, SiteImage>;

/** トップページ最上部の背景に敷き詰める活動写真（暗く重ねて表示） */
export const heroMosaic: SiteImage[] = [
  { src: "/images/activities/tokachi-farm.jpg", alt: "", placeholder: "" },
  { src: "/images/activities/autumnfest-2024.jpg", alt: "", placeholder: "", position: "50% 60%" },
  { src: "/images/activities/australia-field.jpg", alt: "", placeholder: "", position: "50% 70%" },
  { src: "/images/activities/tokachi-potato.jpg", alt: "", placeholder: "" },
  { src: "/images/activities/nanporo-corn.jpg", alt: "", placeholder: "" },
  { src: "/images/activities/tokachi-garlic.jpg", alt: "", placeholder: "" },
];
