/**
 * 料金に関する情報（オーナー確認済みの料金表に基づく）。
 *
 * - 未確定の金額は入力しないでください。
 * - 表示価格は税別（taxNote）。
 */

import type { BudgetParam } from "@/lib/validation";

export const pricingPolicy = {
  /** 最低料金（マイクロインフルエンサー5名） */
  minimumOrder: "5万円〜",
  minimumOrderNote: "マイクロインフルエンサー5名の調整で5万円（税別）から。",
  taxNote: "表示価格はすべて税別です。",
  points: [
    "インフルエンサーへの報酬を含んだ料金です",
    "フォロワー1万人未満のマイクロインフルエンサーは、人数に応じた定額",
    "フォロワー1万人以上のインフルエンサーは、条件に応じて個別にお見積もり",
  ],
  disclaimer: "内容に応じて個別にご相談いただけます。",
};

export type MicroOption = {
  /** マイクロインフルエンサーのみで依頼する場合のおすすめ */
  recommended?: boolean;
  /** 調整する発信者の人数 */
  people: number;
  /** 料金（万円） */
  price: number;
  param: BudgetParam;
};

/** マイクロインフルエンサー（フォロワー1万人未満） */
export const microPlan = {
  label: "MICRO INFLUENCER",
  name: "マイクロインフルエンサー",
  condition: "フォロワー1万人未満",
  options: [
    { people: 5, price: 5, param: "5" },
    { people: 10, price: 8, param: "8", recommended: true },
    { people: 15, price: 10, param: "15" },
  ] satisfies MicroOption[],
  suitedFor: "店舗PR・新商品告知・認知拡大におすすめ",
};

/** インフルエンサー（フォロワー1万人以上） */
export const influencerPlan = {
  label: "INFLUENCER",
  name: "インフルエンサー",
  condition: "フォロワー1万人以上",
  price: "別途お見積もり",
  note: "発信者の条件・投稿内容・企画規模に応じてご提案します。",
  param: "other" as BudgetParam,
  /** 枠内に表示する発信者（アイコンのみ） */
  featuredCreatorIds: ["namaragurume", "kenji-gourmet", "kitagohan", "rui", "mokkun", "rikomogu"],
};

/** 一番のおすすめ（マイクロ＋インフルエンサーの組み合わせ） */
export const comboPlan = {
  label: "BEST",
  title: "一番のおすすめ",
  items: [
    { name: "マイクロインフルエンサー10名", price: "8万円" },
    { name: "おすすめインフルエンサー数名", price: "別途お見積もり" },
  ],
  note: "幅広いフォロワー層への拡散と、影響力のある発信者による話題づくりを組み合わせたプランです。",
  param: "other" as BudgetParam,
};
