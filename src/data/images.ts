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
  /** src が空のときにプレースホルダーに表示するラベル */
  placeholder: string;
};

export const images = {
  heroFood: {
    src: "",
    alt: "北海道のグルメ料理の写真",
    placeholder: "北海道グルメ写真",
  },
  heroShooting: {
    src: "",
    alt: "グルメインフルエンサーが料理を撮影している様子",
    placeholder: "インフルエンサー撮影風景",
  },
  aboutMain: {
    src: "",
    alt: "運営メディア なまらグルメの活動の様子",
    placeholder: "なまらグルメ活動写真",
  },
  aboutSub: {
    src: "",
    alt: "北海道の食材・料理の写真",
    placeholder: "北海道の食材写真",
  },
  reason1: { src: "", alt: "北海道のグルメ料理", placeholder: "北海道グルメ" },
  reason2: { src: "", alt: "なまらグルメが運営する飲食店", placeholder: "自社運営店舗" },
  reason3: { src: "", alt: "グルメ発信者による撮影", placeholder: "発信者ネットワーク" },
  reason4: { src: "", alt: "PR企画の打ち合わせ", placeholder: "企画提案" },
  reason5: { src: "", alt: "SNS投稿のレポート", placeholder: "効果レポート" },
  serviceHero: {
    src: "",
    alt: "SNS向けにグルメを撮影する様子",
    placeholder: "撮影・PR実施風景",
  },
  founder: {
    src: "",
    alt: "なまらグルメ 運営者 島田",
    placeholder: "運営者写真",
  },
  partnerHero: {
    src: "",
    alt: "グルメを撮影するインフルエンサー",
    placeholder: "発信者の撮影風景",
  },
} satisfies Record<string, SiteImage>;
