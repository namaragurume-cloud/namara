/** アプリ共通のエラーコードと、ユーザーに見せる文言 */
export const ERROR_MESSAGES = {
  not_authenticated: "ログインしてください。",
  forbidden: "この操作を行う権限がありません。",
  validation: "入力内容をご確認ください。",
  invalid_quantity: "数量を確認してください。",
  product_not_found: "この商品は見つかりませんでした。",
  store_inactive: "この店舗は現在、受付を停止しています。",
  pickup_ended: "受付時間が終了しました。",
  sold_out: "申し訳ありません。この商品は売り切れました。",
  not_available: "現在この商品は受付を停止しています。",
  quantity_limit: "1回にお申し込みできる数を超えています。",
  insufficient_stock: "申し訳ありません。残りの数が足りません。数量を減らしてお試しください。",
  already_reserved: "この商品はすでに予約しています。",
  too_many_active: "同時に予約できるのは3件までです。受け取り後に、また食べつないでください。",
  reservation_not_found: "予約が見つかりませんでした。",
  not_cancellable: "キャンセルできる期間を過ぎているか、キャンセルできない状態です。",
  reason_required: "キャンセル理由を入力してください。",
  has_active_reservations: "予約が入っているため、この変更はできません。",
  invalid_status: "この状態には変更できません。",
  below_reserved: "予約済みの数より少なくはできません。",
  invalid_plan: "プランが正しくありません。",
  invalid_token: "QRコードを確認できませんでした。店舗スタッフにお声がけください。",
  already_ordered: "この商品はすでに注文しています。",
  too_many_pending: "お支払い待ちの注文が多すぎます。お支払いを済ませるか、しばらくしてからお試しください。",
  order_not_found: "注文が見つかりませんでした。",
  order_not_paid: "お支払いが完了していない注文です。",
  order_not_refunded: "返金が完了していない注文です。",
  invalid_order_transition: "この注文の状態は変更できません。",
  order_immutable: "注文の内容は変更できません。",
  already_paid: "この注文はお支払い済みです。",
  not_payable: "この注文はお支払いできません。",
  payment_expired: "お支払いの有効期限が切れました。もう一度ご注文ください。",
  v2_checkout_closed: "現在オンラインでの購入は準備中です。",
  store_payment_unavailable: "現在この店舗の商品は購入できません。",
  payment_unavailable: "現在オンライン決済を利用できません。時間をおいてお試しください。",
  too_many_attempts: "お支払いの試行回数が多すぎます。もう一度ご注文ください。",
  checkout_failed: "決済画面を開けませんでした。もう一度お試しください。",
  not_refundable: "この注文は返金できません。",
  already_refunded: "この注文は返金済みです。",
  refund_window_closed: "お客様都合のキャンセル・返金は、お支払いから一定時間内かつ受取開始前のみ受け付けています。",
  refund_failed: "返金の処理に失敗しました。時間をおいてもう一度お試しください。",
  refund_not_found: "返金が見つかりませんでした。",
  pickup_too_early: "まだ受取時間ではありません。受取時間になってからお店でスワイプしてください。",
  pickup_window_closed: "受取時間を過ぎたため、受取完了にできません。",
  not_pickupable: "この注文は受け取りできません。",
  stripe_account_exists: "この店舗にはすでに売上受取用のアカウントがあります。",
  upload_unavailable: "画像のアップロードは現在利用できません。",
  invalid_image: "JPEG / PNG / WebP の画像（5MBまで）を選んでください。",
  rate_limited: "短時間に操作が集中しています。少し時間をおいてお試しください。",
  line_not_configured: "LINEログインは現在準備中です。",
  login_failed: "ログインできませんでした。もう一度お試しください。",
  unknown: "エラーが発生しました。時間をおいてもう一度お試しください。",
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export function errorMessage(code: string): string {
  return (ERROR_MESSAGES as Record<string, string>)[code] ?? ERROR_MESSAGES.unknown;
}

export class AppError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? errorMessage(code));
    this.name = "AppError";
    this.code = code;
  }

  /** DB 関数の 'TT:<code>' 例外を AppError に変換する。それ以外はそのまま返す。 */
  static from(error: unknown): unknown {
    if (error instanceof AppError) return error;
    const message = error instanceof Error ? error.message : String(error);
    const match = /TT:([a-z_]+)/.exec(message);
    if (match) return new AppError(match[1]);
    return error;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
