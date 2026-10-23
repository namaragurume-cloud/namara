import { calcOrderAmounts, PRICING } from "./fees";

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

/** v2 の受け取り方（商品詳細）。店頭でのお会計・QR はない */
export const PICKUP_STEPS = [
  "オンラインで事前決済",
  "受取時間に店舗へ",
  "スタッフへ受取チケットをご提示ください",
  "商品を受け取ったら、ご自身でスワイプして受取完了",
] as const;

/**
 * 商品詳細・購入確認の支払いの内訳（表示用）。注文の金額はサーバーの注文作成で確定する。金額は注文の計算（calcOrderAmounts）と同じ関数で出す。
 * つなぐチャージ・付与ポイントは platform_settings の値を渡す。
 */
export function priceBreakdown(unitPrice: number, tsunaguCharge: number, orderPoints: number, quantity = 1) {
  const a = calcOrderAmounts([{ unitPrice, quantity }], 0, tsunaguCharge);
  return { subtotal: a.subtotal, tsunaguCharge: a.tsunaguCharge, total: a.total, points: orderPoints };
}

/** ポイントの説明（「実質無料」「得する」などの表現はしない） */
export function pointsNote(tsunaguCharge: number, orderPoints: number) {
  return `つなぐチャージ${tsunaguCharge}円につき、${orderPoints}ptを付与します。`;
}

/** 購入ボタンの文言（支払総額を出す） */
export function buyLabel(total: number) {
  return `${total.toLocaleString("ja-JP")}円で食べつなぐ`;
}

/**
 * 店舗の「受け取り時のご案内」が旧フロー（予約 → 店頭 QR → レジ）向けの文言か。
 * v2 では表示しない（DB の値は旧導線で使うため変えない）。
 */
export function isLegacyPickupNote(note: string): boolean {
  return /予約|QR|ＱＲ|レジ|お会計|チェックイン/i.test(note);
}

/**
 * v2 購入確認の状態。CTA を出すか、どの理由で購入できないかを決める（サーバーでも注文作成時に再確認する）。
 * 優先順: 注文済み → 決済待ちの注文あり（再開）→ 購入受付の停止 → 受付終了 → 売り切れ → 決済準備中 → 購入できる
 */
export type BuyState =
  | { kind: "buy" }
  | { kind: "resume"; orderId: string; total: number }
  | { kind: "ordered"; orderId: string }
  | { kind: "closed" | "ended" | "sold_out" | "not_ready"; label: string; message: string };

export function buyPageState(input: {
  open: boolean;
  status: string;
  remaining: number;
  pickupEndAt: string;
  storeActive: boolean;
  storePayable: boolean;
  myOrder: { id: string; status: "pending_payment" | "paid"; total: number } | null;
  now: number;
}): BuyState {
  if (input.myOrder?.status === "paid") return { kind: "ordered", orderId: input.myOrder.id };
  if (input.myOrder?.status === "pending_payment") return { kind: "resume", orderId: input.myOrder.id, total: input.myOrder.total };
  if (!input.open) return { kind: "closed", label: "購入準備中", message: "現在オンラインでの購入は準備中です。" };
  if (!input.storeActive || input.status === "closed" || Date.parse(input.pickupEndAt) <= input.now) {
    return { kind: "ended", label: "受付終了", message: "受付時間が終了しました。" };
  }
  if (input.status === "sold_out" || input.remaining <= 0) {
    return { kind: "sold_out", label: "売り切れ", message: "申し訳ありません。この商品は売り切れました。" };
  }
  if (!input.storePayable || input.status !== "published") {
    return { kind: "not_ready", label: "購入準備中", message: "現在この店舗の商品は購入準備中です。" };
  }
  return { kind: "buy" };
}

/** 購入確認の「決済後の流れ」 */
export const AFTER_PAYMENT_STEPS = ["オンラインで決済", "受取チケットが発行されます", "お店で受け取り、ご自身でスワイプして完了"] as const;
