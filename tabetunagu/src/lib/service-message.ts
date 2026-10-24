/**
 * LINE ミニアプリのサービスメッセージ（表示用の値の組み立て・設定の検証）。
 *
 * サービスメッセージは LINE が用意したテンプレート（LINE Developers コンソールで選ぶ）だけを使い、自由文は送らない。
 * 用途はユーザーの操作に対する確認・応答（注文完了・受取のリマインド・状態変更）だけ。値下げ・新商品・クーポン・おすすめなどの販促は送らない。
 */

/** 送ってよい通知の種類（販促の種類は定義しない） */
export const SERVICE_MESSAGE_TYPES = ["demo_order_completed", "order_completed", "pickup_reminder", "order_status_changed"] as const;
export type ServiceMessageType = (typeof SERVICE_MESSAGE_TYPES)[number];

/** テンプレート変数に入れられる TABETUNAGU の項目（これ以外は送らない。個人情報は含めない） */
export const ORDER_PARAM_FIELDS = ["storeName", "items", "pickup", "orderNumber", "total", "orderPath"] as const;
export type OrderParamField = (typeof ORDER_PARAM_FIELDS)[number];

export type OrderMessageValues = Record<OrderParamField, string>;

/** テンプレート名: {テンプレート名}_{言語タグ}・30文字以内 */
export function isValidTemplateName(name: string) {
  return name.length <= 30 && /^[A-Za-z0-9_]+_[a-z]{2}(-[A-Za-z]{2,4})?$/.test(name);
}

/**
 * テンプレート変数の対応（環境変数の JSON）を検証する。キー = テンプレート変数名、値 = TABETUNAGU の項目。
 * 不正なら null（送信しない）。
 */
export function parseParamMapping(raw: string): Record<string, OrderParamField> | null {
  if (!raw.trim()) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0 || entries.length > 20) return null;
  const out: Record<string, OrderParamField> = {};
  for (const [key, value] of entries) {
    if (!/^[A-Za-z0-9_]{1,50}$/.test(key)) return null;
    if (typeof value !== "string" || !(ORDER_PARAM_FIELDS as readonly string[]).includes(value)) return null;
    out[key] = value as OrderParamField;
  }
  return out;
}

/** テンプレート変数の値（各値は短く切る。テンプレートの文字数制限を超えないように） */
export function buildParams(mapping: Record<string, OrderParamField>, values: OrderMessageValues, maxLength = 50) {
  const params: Record<string, string> = {};
  for (const [key, field] of Object.entries(mapping)) {
    const v = values[field] ?? "";
    params[key] = v.length > maxLength ? `${v.slice(0, maxLength - 1)}…` : v;
  }
  return params;
}

/** LINE API のエラーの分類（画面・記録にはこれだけを出す。トークンやレスポンス本文は出さない） */
export type ServiceMessageErrorCategory =
  | "not_enabled"
  | "not_configured"
  | "not_line_user"
  | "no_token"
  | "token_exhausted"
  | "duplicate"
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "line_unavailable"
  | "network_error";

export function errorCategoryForStatus(status: number): ServiceMessageErrorCategory {
  if (status === 400) return "bad_request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 429) return "rate_limited";
  return "line_unavailable";
}

/** 同じユーザーがデモ送信を続けて押したときに二重に送らない間隔 */
export const DEMO_RESEND_INTERVAL_MS = 60_000;
