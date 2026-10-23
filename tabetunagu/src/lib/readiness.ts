/**
 * 店舗の導入準備（PoC 公開可否）の判定。DB の既存データから算出する（専用の状態は持たない）。
 *
 * 公開準備の状態（優先順）
 *   未設定        … 店舗が稼働中でない、または店舗情報（住所・電話・営業時間）が未入力
 *   商品準備中    … 商品を一度も登録していない
 *   Stripe設定待ち … 売上受取設定（Stripe Connect）が未完了
 *   公開準備OK    … 上記がすべて完了
 * 「公開中の商品」「モニター準備」はチェック項目として表示するが、公開可否の判定には使わない（日によって変わるため）。
 */
export type StoreReadinessInput = {
  storeActive: boolean;
  hasStoreInfo: boolean;
  productCount: number;
  publishedCount: number;
  stripeReady: boolean;
  monitorOpened: boolean;
};

export type StoreLaunchStatus = "未設定" | "商品準備中" | "Stripe設定待ち" | "公開準備OK";

export function storeReadiness(i: StoreReadinessInput) {
  const items = [
    { key: "info", label: "店舗情報（住所・電話・営業時間）", ok: i.storeActive && i.hasStoreInfo, href: "/store/settings" },
    { key: "products", label: "商品登録済み", ok: i.productCount > 0, href: "/store/products/new" },
    { key: "stripe", label: "売上受取設定（Stripe）", ok: i.stripeReady, href: "/store/payouts" },
    { key: "published", label: "公開中の商品あり", ok: i.publishedCount > 0, href: "/store/products" },
    { key: "monitor", label: "受取モニターを開いた（店頭端末の準備）", ok: i.monitorOpened, href: "/store/monitor" },
  ];
  let status: StoreLaunchStatus;
  if (!i.storeActive || !i.hasStoreInfo) status = "未設定";
  else if (i.productCount === 0) status = "商品準備中";
  else if (!i.stripeReady) status = "Stripe設定待ち";
  else status = "公開準備OK";
  return { items, status };
}
