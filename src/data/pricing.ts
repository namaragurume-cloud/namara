/**
 * 料金に関する情報。
 *
 * - 未確定の金額は入力しないでください（price が空なら「個別見積もり」と表示）。
 * - 最低受注価格（minimumOrder）と各プランの価格は別の情報として管理しています。
 * - 税込・税別の表記は未決定です。決まったら taxNote に入力してください。
 */

import type { BudgetParam } from "@/lib/validation";

export const pricingPolicy = {
  /** 最低受注価格の目安 */
  minimumOrder: "3万円〜",
  minimumOrderNote: "ご予算3万円からご相談いただけます。",
  /** 例: "表示価格はすべて税別です。" 未決定のため空欄 */
  taxNote: "",
  points: [
    "インフルエンサーへの報酬を含んだ総額でご提示します",
    "フォロワー規模・起用人数・投稿形式に応じて個別に調整します",
    "料金に含まれる作業範囲は、ご契約前に明示します",
  ],
  disclaimer:
    "料金は起用する発信者、投稿媒体、制作内容、実施時期などによって変動します。詳細はお見積もりにてご案内します。",
  budgetNote: "予算の目安は活用イメージです。提供内容や金額をお約束するものではありません。",
};

export type Plan = {
  id: string;
  /** 予算イメージ（提供内容や金額を確約するものではありません） */
  budget: { label: string; text: string; param: BudgetParam };
  label: string;
  name: string;
  description: string;
  /** 確定した価格のみ入力。空欄なら「個別見積もり」 */
  price: string;
  priceNote?: string;
  suitedFor: string[];
};

export const plans: Plan[] = [
  {
    id: "single",
    budget: { label: "3万円〜10万円", text: "インフルエンサー1名からのPR相談", param: "3-10" },
    label: "PLAN A",
    name: "インフルエンサー1名プラン",
    description: "SNS広告を試してみたい方や、新メニューPR、商品PRなどに適したプラン。",
    price: "",
    suitedFor: ["SNS広告を試してみたい方", "新メニューのPR", "商品のPR"],
  },
  {
    id: "multiple",
    budget: { label: "10万円〜30万円", text: "複数人の起用やキャンペーン企画の相談", param: "10-30" },
    label: "PLAN B",
    name: "複数人キャスティングプラン",
    description: "複数の発信者を組み合わせ、異なるフォロワー層にPRを届けるプラン。",
    price: "",
    suitedFor: ["幅広い層への認知拡大", "新店舗OPEN時の告知", "キャンペーンの話題化"],
  },
  {
    id: "custom",
    budget: { label: "30万円以上", text: "大型PRやイベントを含めた個別設計", param: "30" },
    label: "PLAN C",
    name: "オーダーメイドプラン",
    description: "大型インフルエンサー、複数媒体、PRイベントなどを組み合わせたプラン。",
    price: "",
    suitedFor: ["大型インフルエンサーの起用", "複数媒体での展開", "PRイベントとの組み合わせ"],
  },
];
