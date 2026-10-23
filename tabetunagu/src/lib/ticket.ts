import { pickupDeadline } from "./deals";
import { hhmm } from "./format";

/**
 * デジタル受取チケットの表示ルールと、スワイプ操作の状態遷移（画面から切り離してテストできるようにする）。
 * 受取完了の可否・冪等性はサーバー（pickup_order）が正。ここは表示と操作のためだけ。
 */

export type TicketTiming =
  | { kind: "upcoming"; canSwipe: false; note: string }
  | { kind: "active"; canSwipe: true; note: string | null; urgent: boolean }
  | { kind: "grace"; canSwipe: true; note: string; urgent: true }
  | { kind: "closed"; canSwipe: false; note: string };

/**
 * 受取時間に対するいまの位置。
 * - upcoming: スワイプできる時刻（受取開始 − 早めの猶予）より前。「受取開始まであと○分」/「HH:MMから受け取れます」
 * - active: 受取時間中（早めの猶予を含む）。終了が近ければ「受取終了まであと○分」
 * - grace: 受取終了を過ぎたが、遅めの猶予の間はまだ受取完了にできる
 * - closed: 猶予も過ぎた（未受取になる）
 */
export function ticketTiming(
  o: { pickupStartAt: string; pickupEndAt: string; pickupOpensAt: string; pickupClosesAt: string },
  now: Date,
): TicketTiming {
  const t = now.getTime();
  const start = Date.parse(o.pickupStartAt);
  const end = Date.parse(o.pickupEndAt);
  if (t < Date.parse(o.pickupOpensAt)) {
    const minutes = Math.ceil((start - t) / 60_000);
    return {
      kind: "upcoming",
      canSwipe: false,
      note: minutes <= 60 ? `受取開始まであと${minutes}分` : `${hhmm(o.pickupStartAt)}から受け取れます`,
    };
  }
  if (t <= end) {
    const d = pickupDeadline(o.pickupEndAt, now);
    if (t < start) return { kind: "active", canSwipe: true, note: `受取開始まであと${Math.ceil((start - t) / 60_000)}分`, urgent: false };
    return { kind: "active", canSwipe: true, note: d?.soon ? `受取終了まで${d.label}` : null, urgent: Boolean(d?.soon) };
  }
  if (t <= Date.parse(o.pickupClosesAt)) {
    return { kind: "grace", canSwipe: true, note: `受取時間を過ぎています（${hhmm(o.pickupClosesAt)}まで受取完了にできます）`, urgent: true };
  }
  return { kind: "closed", canSwipe: false, note: "受取時間を過ぎました" };
}

// ---------------------------------------------------------------------------
// スワイプ操作の状態遷移
// ---------------------------------------------------------------------------

/** これ以上右へ動かしたら確定（トラック内の可動幅に対する割合）。既存仕様の 90% */
export const CONFIRM_RATIO = 0.9;
/** 分析用の「スワイプ開始」とみなす割合 */
export const STARTED_RATIO = 0.2;

export type SwipeState =
  | { phase: "idle"; x: number; error: string | null }
  | { phase: "dragging"; x: number; startX: number; startAt: number; error: null }
  | { phase: "pending"; x: number; error: null }
  | { phase: "done"; x: number; error: null };

export type SwipeAction =
  | { type: "down"; clientX: number; at: number }
  | { type: "move"; clientX: number; maxX: number }
  | { type: "up"; maxX: number }
  | { type: "key"; key: string; maxX: number }
  | { type: "result"; ok: boolean; message?: string };

export const initialSwipe: SwipeState = { phase: "idle", x: 0, error: null };

/** 確定に十分な位置か（90% 以上） */
export function reachedConfirm(x: number, maxX: number) {
  return maxX > 0 && x >= maxX * CONFIRM_RATIO;
}

/**
 * 状態遷移。確定（pending への遷移）は「90% 以上で指を離した」「キーボードで右端まで動かした」ときだけ。
 * pending・done の間は操作を受け付けない（二重送信しない）。失敗したら初期位置へ戻す。
 */
export function swipeReducer(state: SwipeState, action: SwipeAction): SwipeState {
  if (state.phase === "pending") {
    if (action.type !== "result") return state;
    return action.ok ? { phase: "done", x: state.x, error: null } : { phase: "idle", x: 0, error: action.message ?? PICKUP_ERROR_MESSAGE };
  }
  if (state.phase === "done") return state;
  switch (action.type) {
    case "down":
      return { phase: "dragging", x: state.x, startX: action.clientX - state.x, startAt: action.at, error: null };
    case "move":
      if (state.phase !== "dragging") return state;
      return { ...state, x: Math.min(action.maxX, Math.max(0, action.clientX - state.startX)) };
    case "up":
      if (state.phase !== "dragging") return state;
      return reachedConfirm(state.x, action.maxX) ? { phase: "pending", x: action.maxX, error: null } : { phase: "idle", x: 0, error: null };
    case "key": {
      if (action.key === "ArrowRight") {
        const x = Math.min(action.maxX, state.x + action.maxX / 4);
        return reachedConfirm(x, action.maxX) ? { phase: "pending", x: action.maxX, error: null } : { phase: "idle", x, error: null };
      }
      if (action.key === "ArrowLeft" || action.key === "Home" || action.key === "Escape") return { phase: "idle", x: 0, error: null };
      return state;
    }
    default:
      return state;
  }
}

/** 通信エラーなど、理由が分からない失敗のときの文言（技術的なコードは出さない） */
export const PICKUP_ERROR_MESSAGE = "受取完了を確認できませんでした。通信状況を確認して、もう一度お試しください。";

/** 受取完了の結果に応じた文言。理由が分かるもの（受取時間前など）はその文言、それ以外は共通の文言 */
export function pickupErrorMessage(res: { ok: boolean; code?: string; message?: string } | null | undefined): string {
  if (!res || res.code === "unknown" || !res.message) return PICKUP_ERROR_MESSAGE;
  return res.message;
}

/** 失敗のうち、サーバーの状態が変わっている可能性があるもの（画面を取り直して正しい表示へ切り替える） */
export const REFRESH_ON_ERROR = new Set(["pickup_window_closed", "not_pickupable", "already_refunded", "order_not_paid", "pickup_too_early"]);
