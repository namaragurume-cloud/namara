/**
 * 料金プラン（すべて仮設定）。
 * 本番では plans テーブルに保存し、運営画面から価格・機能制限・利用枠を変更できるようにする（Phase 10）。
 */
export type Plan = {
  id: "free" | "starter" | "growth" | "pro" | "sponsored_search" | "consumer_research";
  name: string;
  priceYen: number;
  unit: "月" | "件";
  from: boolean;
  features: string[];
  limits: { stores: number | null; aiReplyDrafts: number | null; demandScope: "none" | "area" | "all" };
};

export const PLANS: Plan[] = [
  { id: "free", name: "無料店舗登録", priceYen: 0, unit: "月", from: false, features: ["店舗情報の掲載", "自店の表示回数"], limits: { stores: 1, aiReplyDrafts: 0, demandScope: "none" } },
  { id: "starter", name: "SaaS STARTER", priceYen: 5980, unit: "月", from: false, features: ["口コミ管理", "AI返信案", "自店エリアの検索需要"], limits: { stores: 1, aiReplyDrafts: 30, demandScope: "area" } },
  { id: "growth", name: "SaaS GROWTH", priceYen: 14800, unit: "月", from: false, features: ["STARTERの全機能", "NAMARA VOICE", "NAMARA ACTION", "全エリアの検索需要"], limits: { stores: 3, aiReplyDrafts: 150, demandScope: "all" } },
  { id: "pro", name: "SaaS PRO", priceYen: 29800, unit: "月", from: false, features: ["GROWTHの全機能", "NAMARA BOOST", "週次LINEレポート", "優先サポート"], limits: { stores: 10, aiReplyDrafts: null, demandScope: "all" } },
  { id: "sponsored_search", name: "スポンサー検索広告", priceYen: 9800, unit: "月", from: true, features: ["検索結果内の広告枠（最大1件・広告表記あり）"], limits: { stores: null, aiReplyDrafts: null, demandScope: "none" } },
  { id: "consumer_research", name: "消費者リサーチ", priceYen: 39800, unit: "件", from: true, features: ["匿名集計による需要レポート"], limits: { stores: null, aiReplyDrafts: null, demandScope: "all" } },
];

export const planName = (id: string) => PLANS.find((p) => p.id === id)?.name ?? id;
