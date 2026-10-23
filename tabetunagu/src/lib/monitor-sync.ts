import { detectNewPickups, type MonitorSnapshot } from "./monitor";

/**
 * 店舗モニターの同期状態（ブラウザ側の一時的な状態。DB には保存しない）。
 * - 受取完了の通知音: 新しく受取完了になった注文を初めて検知したときだけ、1回の更新につき1回鳴らす
 *   （初回表示・ページの再読み込み・通信の復旧時に取得した過去の受取完了では鳴らさない）
 * - 受取完了の強調: 新しく受取完了になった注文を約10秒「✓ 受取完了」として強調
 * - 通信断: 最後に正常に取得した一覧を保持し、接続状態と最終更新時刻だけを変える
 */

export const HIGHLIGHT_MS = 10_000;

export type Connection = "ok" | "error" | "reconnecting";

export type MonitorSyncState = {
  snapshot: MonitorSnapshot;
  /** 受取完了として既に知っている注文 */
  known: ReadonlySet<string>;
  /** 強調中の注文（注文ID → 強調の終了時刻） */
  highlights: Readonly<Record<string, number>>;
  connection: Connection;
  /** 最後に正常に同期できた時刻 */
  lastSyncedAt: number;
  /** 鳴らした回数（増えたら1回鳴らす） */
  chimes: number;
};

export type MonitorSyncEvent =
  | { type: "request"; at: number }
  | { type: "success"; at: number; snapshot?: MonitorSnapshot }
  | { type: "failure"; at: number }
  | { type: "tick"; at: number };

export function initMonitorSync(snapshot: MonitorSnapshot, at: number): MonitorSyncState {
  return { snapshot, known: detectNewPickups(null, snapshot.orders).known, highlights: {}, connection: "ok", lastSyncedAt: at, chimes: 0 };
}

export function monitorSyncReducer(state: MonitorSyncState, e: MonitorSyncEvent): MonitorSyncState {
  switch (e.type) {
    case "request":
      // 通信エラーのあとの再試行中は「再接続しています…」
      return state.connection === "error" ? { ...state, connection: "reconnecting" } : state;
    case "failure":
      return { ...state, connection: "error" };
    case "tick":
      return pruneHighlights(state, e.at);
    case "success": {
      const recovering = state.connection !== "ok";
      let next: MonitorSyncState = { ...state, connection: "ok", lastSyncedAt: e.at };
      if (e.snapshot) {
        // 復旧直後に取得した受取完了は「再接続前から存在していた」ものとして、音・強調なしで既知にする
        const { fresh, known } = detectNewPickups(recovering ? null : state.known, e.snapshot.orders);
        const merged = new Set([...state.known, ...known]);
        const highlights = { ...state.highlights };
        for (const id of fresh) highlights[id] = e.at + HIGHLIGHT_MS;
        next = { ...next, snapshot: e.snapshot, known: merged, highlights, chimes: state.chimes + (fresh.length > 0 ? 1 : 0) };
      }
      return pruneHighlights(next, e.at);
    }
  }
}

function pruneHighlights(state: MonitorSyncState, at: number): MonitorSyncState {
  const entries = Object.entries(state.highlights);
  const kept = entries.filter(([, until]) => until > at);
  return kept.length === entries.length ? state : { ...state, highlights: Object.fromEntries(kept) };
}

/** 接続状態の表示（技術的なエラーコードは出さない） */
export function connectionLabel(c: Connection) {
  return c === "ok" ? "接続中" : c === "reconnecting" ? "再接続しています…" : "更新できません。通信状況をご確認ください。";
}
