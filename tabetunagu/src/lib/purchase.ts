import { PRICING } from "./fees";

/**
 * v2（事前決済）の商品詳細の CTA。
 * 優先順: 注文済み → 受付終了 → 売り切れ → 店舗の決済準備中 → 購入できる
 * - 受付終了: 受取終了時刻を過ぎた / 受付停止 / 店舗が稼働停止
 * - 決済準備中: 店舗の売上受取設定（Stripe Connect）が未完了。商品は掲載したまま、購入だけできない
 */
export type V2Cta =
  | { kind: "order"; label: string; href: string }
  | { kind: "buy"; label: string; href: string }
  | { kind: "ended" | "sold_out" | "not_ready"; label: string; note?: string };

export function v2ProductCta(input: {
  productId: string;
  status: string;
  remaining: number;
  pickupEndAt: string;
  storeActive: boolean;
  storePayable: boolean;
  myOrderId: string | null;
  now: number;
}): V2Cta {
  if (input.myOrderId) return { kind: "order", label: "注文を確認する", href: `/orders/${input.myOrderId}` };
  if (!input.storeActive || input.status === "closed" || Date.parse(input.pickupEndAt) <= input.now) {
    return { kind: "ended", label: "受付終了" };
  }
  if (input.status === "sold_out" || input.remaining <= 0) return { kind: "sold_out", label: "売り切れ" };
  if (!input.storePayable || input.status !== "published") {
    return { kind: "not_ready", label: "購入準備中", note: "現在この店舗の商品は購入準備中です。" };
  }
  return { kind: "buy", label: "食べつなぐ", href: `/products/${input.productId}/buy` };
}

/** つなぐチャージとポイントの説明（断定的な「お得」表現はしない） */
export const chargeNote = {
  short: `購入時に${PRICING.tsunaguCharge}円のつなぐチャージが加算されます。`,
  points: `つなぐチャージ${PRICING.tsunaguCharge}円につき、${PRICING.orderPoints}ptを付与します。`,
};

/** v2 の受け取り方の案内（商品詳細）。店頭でのお会計・QR はない */
export const pickupGuide =
  "受取時間内にご来店いただき、スタッフへ受取チケットをご提示ください。商品を受け取ったら、ご自身で画面をスワイプして受取完了です。店頭でのお会計はありません。";

/**
 * 店舗の「受け取り時のご案内」が旧フロー（予約 → 店頭 QR → レジ）向けの文言か。
 * v2 では表示しない（DB の値は旧導線で使うため変えない）。
 */
export function isLegacyPickupNote(note: string): boolean {
  return /予約|QR|ＱＲ|レジ|お会計|チェックイン/i.test(note);
}
