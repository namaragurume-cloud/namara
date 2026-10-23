import { pickupPhase, pickupWindow } from "./monitor";
import type { OrderStatus } from "./orders";
import { ticketTiming } from "./ticket";

/**
 * マイページ・注文履歴の表示ルール（画面から切り離してテストできるようにする）。
 * 注文の状態・受取の可否・ポイントの付与はサーバー（DB）が正。ここは表示のためだけ。
 */

/** ユーザー向けの状態名（内部の status 名は画面に出さない） */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "お支払い待ち",
  paid: "受取待ち",
  picked_up: "受取完了",
  unclaimed: "未受取",
  refunded: "返金済み",
  cancelled: "キャンセル済み",
};

/**
 * 表示上の状態。paid でも受取終了 + 猶予を過ぎていれば（DB の更新前でも）未受取として扱う（受取チケットと同じ判定）。
 */
export function displayStatus(o: { status: OrderStatus; pickupStartAt: string; pickupEndAt: string }, now: Date): OrderStatus {
  if (o.status === "paid" && pickupPhase(o, now.getTime()) === "unclaimed") return "unclaimed";
  return o.status;
}

export type OrderCta = { label: string; href: string };

/** 状態ごとの CTA（状態に関係ない操作は出さない）。どれも注文詳細（受取チケット・決済の再開・返金内容）へ */
export function orderCta(o: { id: string; status: OrderStatus; payable?: boolean }): OrderCta {
  const href = `/orders/${o.id}`;
  switch (o.status) {
    case "pending_payment":
      return { label: o.payable === false ? "注文詳細を見る" : "決済を続ける", href };
    case "paid":
      return { label: "受取チケットを見る", href };
    case "refunded":
      return { label: "返金内容を見る", href };
    default:
      return { label: "注文詳細を見る", href };
  }
}

/** 注文履歴の絞り込み（状態ごとの細かいタブは作らない） */
export type OrderFilter = "all" | "ready" | "done" | "other";

export const ORDER_FILTERS: { id: OrderFilter; label: string; empty: string }[] = [
  { id: "all", label: "すべて", empty: "まだ食べつないだ商品はありません。" },
  { id: "ready", label: "受取待ち", empty: "受取待ちの注文はありません。" },
  { id: "done", label: "完了", empty: "受取完了の注文はまだありません。" },
  { id: "other", label: "その他", empty: "該当する注文はありません。" },
];

/** 絞り込みに含める status（「その他」= 未受取・返金済み・キャンセル済み・お支払い待ち） */
export const FILTER_STATUSES: Record<OrderFilter, readonly OrderStatus[]> = {
  all: ["pending_payment", "paid", "picked_up", "unclaimed", "refunded", "cancelled"],
  ready: ["paid"],
  done: ["picked_up"],
  other: ["unclaimed", "refunded", "cancelled", "pending_payment"],
};

/** URL の ?tab=（以前の状態ごとのタブのリンクも受け付ける） */
export function parseOrderFilter(tab: string | undefined): OrderFilter | null {
  switch (tab) {
    case "all":
    case "ready":
    case "done":
    case "other":
      return tab;
    case "picked_up":
      return "done";
    case "pending":
    case "unclaimed":
    case "refunded":
    case "cancelled":
      return "other";
    default:
      return null;
  }
}

export type PickupOrderLike = { id: string; status: OrderStatus; pickupStartAt: string; pickupEndAt: string };

/**
 * マイページ最上部の「受取待ち」。決済済みで、まだ受取完了にできる（受取終了 + 猶予の前）注文を受取開始の近い順に。
 */
export function upcomingPickups<T extends PickupOrderLike>(orders: T[], now: Date): T[] {
  return orders
    .filter((o) => o.status === "paid" && pickupPhase(o, now.getTime()) !== "unclaimed")
    .sort((a, b) => Date.parse(a.pickupStartAt) - Date.parse(b.pickupStartAt) || a.id.localeCompare(b.id));
}

/** 受取待ちの補助表示（受取チケットと同じ ticketTiming を使う）。「受取終了まであと45分」「受取開始まであと20分」など */
export function pickupHint(o: { pickupStartAt: string; pickupEndAt: string }, now: Date): { text: string; urgent: boolean } | null {
  const w = pickupWindow(o.pickupStartAt, o.pickupEndAt);
  const t = ticketTiming(
    { ...o, pickupOpensAt: new Date(w.opensAt).toISOString(), pickupClosesAt: new Date(w.closesAt).toISOString() },
    now,
  );
  if (t.kind === "closed") return null;
  if (t.kind === "upcoming") return t.note.startsWith("受取開始まで") ? { text: t.note, urgent: false } : null;
  if (t.kind === "grace") return { text: "受取時間を過ぎています", urgent: true };
  return t.note ? { text: t.note, urgent: t.urgent } : { text: "受取時間中です", urgent: false };
}

/** 受取待ちの見出し。すべて本日なら「今日の受取」、それ以外を含むなら「受取待ち」 */
export function pickupHeading(orders: { pickupStartAt: string }[], now: Date) {
  const day = (d: Date | string) => new Date(d).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  return orders.length > 0 && orders.every((o) => day(o.pickupStartAt) === day(now)) ? "今日の受取" : "受取待ち";
}

// ---------------------------------------------------------------------------
// つなぐポイント
// ---------------------------------------------------------------------------

export type PointType = "earned" | "used" | "expired" | "adjusted" | "revoked";

/** ポイント履歴の種別（内部の理由・管理者メモは出さない） */
export const POINT_TYPE_LABEL: Record<PointType, string> = {
  earned: "獲得",
  used: "利用",
  expired: "期限切れ",
  adjusted: "調整",
  revoked: "取消",
};

/** 「+30pt」「-30pt」 */
export function pointsDelta(amount: number) {
  return `${amount > 0 ? "+" : amount < 0 ? "-" : ""}${Math.abs(amount).toLocaleString("ja-JP")}pt`;
}
