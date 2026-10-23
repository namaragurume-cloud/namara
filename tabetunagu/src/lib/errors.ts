/** アプリ共通のエラーコードと、ユーザーに見せる文言 */
export const ERROR_MESSAGES = {
  not_authenticated: "ログインしてください。",
  forbidden: "この操作を行う権限がありません。",
  validation: "入力内容をご確認ください。",
  invalid_quantity: "数量を確認してください。",
  product_not_found: "この商品は見つかりませんでした。",
  store_inactive: "この店舗は現在、受付を停止しています。",
  pickup_ended: "受取時間が終了しました。",
  sold_out: "たった今、すべて予約されました。またのお越しをお待ちしています。",
  not_available: "現在この商品は予約を受け付けていません。",
  quantity_limit: "1回に予約できる数を超えています。",
  insufficient_stock: "残りの数が足りません。数量を減らしてお試しください。",
  already_reserved: "この商品はすでに予約しています。",
  too_many_active: "同時に予約できるのは3件までです。受け取り後に、また食べつないでください。",
  reservation_not_found: "予約が見つかりませんでした。",
  not_cancellable: "この予約はキャンセルできません。",
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
