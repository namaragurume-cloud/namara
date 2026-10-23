import { describe, expect, it } from "vitest";
import { startUrgency, type MonitorOrder, type MonitorSnapshot } from "@/lib/monitor";
import { connectionLabel, FAILURES_BEFORE_WARNING, HIGHLIGHT_MS, initMonitorSync, monitorSyncReducer, type MonitorSyncEvent, type MonitorSyncState } from "@/lib/monitor-sync";

const T0 = Date.parse("2026-10-23T22:40:00+09:00");

function order(id: string, status: MonitorOrder["status"]): MonitorOrder {
  return {
    id,
    orderNumber: id.toUpperCase(),
    status,
    customerName: "デ＊＊＊ 様",
    items: [{ name: "BOX", quantity: 1 }],
    pickupStartAt: "2026-10-23T22:00:00+09:00",
    pickupEndAt: "2026-10-23T23:30:00+09:00",
    pickedUpAt: status === "picked_up" ? "2026-10-23T22:30:00+09:00" : null,
    phase: status === "picked_up" ? "picked_up" : "active",
  };
}
const snap = (version: string, orders: MonitorOrder[]): MonitorSnapshot => ({
  storeId: "s",
  storeName: "店",
  generatedAt: new Date(T0).toISOString(),
  version,
  orders,
});
const run = (s: MonitorSyncState, events: MonitorSyncEvent[]) => events.reduce(monitorSyncReducer, s);

describe("受取完了の通知音", () => {
  it("初回表示（ページの再読み込みを含む）にある受取完了では鳴らさず、強調もしない", () => {
    const s = initMonitorSync(snap("1", [order("a", "picked_up"), order("b", "paid")]), T0);
    expect(s.chimes).toBe(0);
    expect(s.highlights).toEqual({});
  });

  it("新しい受取完了を初めて検知したら1回。同時に2件でも1回。同じ注文では二度鳴らさない", () => {
    let s = initMonitorSync(snap("1", [order("a", "paid"), order("b", "paid"), order("c", "paid")]), T0);
    s = run(s, [{ type: "success", at: T0 + 2000, snapshot: snap("2", [order("a", "picked_up"), order("b", "picked_up"), order("c", "paid")]) }]);
    expect(s.chimes).toBe(1);
    s = run(s, [{ type: "success", at: T0 + 4000, snapshot: snap("3", [order("a", "picked_up"), order("b", "picked_up"), order("c", "paid")]) }]);
    expect(s.chimes).toBe(1);
    s = run(s, [{ type: "success", at: T0 + 6000, snapshot: snap("4", [order("a", "picked_up"), order("b", "picked_up"), order("c", "picked_up")]) }]);
    expect(s.chimes).toBe(2);
  });

  it("通信の復旧時: 途絶えている間の受取完了では鳴らさない（強調もしない）。復旧後に新しく発生した受取完了は通常どおり1回", () => {
    let s = initMonitorSync(snap("1", [order("a", "paid"), order("b", "paid"), order("c", "paid")]), T0);
    s = run(s, [
      { type: "request", at: T0 + 2000 },
      { type: "failure", at: T0 + 2000 },
      { type: "request", at: T0 + 4000 },
      { type: "failure", at: T0 + 4000 },
      { type: "request", at: T0 + 6000 },
      { type: "success", at: T0 + 6000, snapshot: snap("5", [order("a", "picked_up"), order("b", "picked_up"), order("c", "paid")]) },
    ]);
    expect(s.chimes).toBe(0);
    expect(s.highlights).toEqual({});
    expect(s.snapshot.version).toBe("5"); // 最新の状態には追いつく
    s = run(s, [{ type: "success", at: T0 + 8000, snapshot: snap("6", [order("a", "picked_up"), order("b", "picked_up"), order("c", "picked_up")]) }]);
    expect(s.chimes).toBe(1);
    expect(Object.keys(s.highlights)).toEqual(["c"]);
  });
});

describe("受取完了の強調（約10秒）", () => {
  it("新しい受取完了を10秒強調し、10秒後に通常表示へ。再読み込み後（初期化）は強調しない", () => {
    let s = initMonitorSync(snap("1", [order("a", "paid")]), T0);
    s = run(s, [{ type: "success", at: T0 + 2000, snapshot: snap("2", [order("a", "picked_up")]) }]);
    expect(s.highlights).toEqual({ a: T0 + 2000 + HIGHLIGHT_MS });
    expect(HIGHLIGHT_MS).toBe(10_000);
    s = run(s, [{ type: "tick", at: T0 + 2000 + 9_999 }]);
    expect(s.highlights).toHaveProperty("a");
    s = run(s, [{ type: "tick", at: T0 + 2000 + 10_000 }]);
    expect(s.highlights).toEqual({});
    expect(initMonitorSync(s.snapshot, T0 + 60_000).highlights).toEqual({});
  });
});

describe("通信断・再接続・最終更新", () => {
  it("1回だけの失敗では警告しない（小さな通信の揺れで店舗を不安にさせない）", () => {
    const before = initMonitorSync(snap("1", [order("a", "paid")]), T0);
    const once = run(before, [
      { type: "request", at: T0 + 2000 },
      { type: "failure", at: T0 + 2000 },
    ]);
    expect(FAILURES_BEFORE_WARNING).toBe(2);
    expect(once.connection).toBe("ok");
    expect(once.failures).toBe(1);
    expect(run(once, [{ type: "request", at: T0 + 4000 }]).connection).toBe("ok");
    // 次が成功すれば失敗回数は 0 に戻る（1回 → 成功 → 1回 でも警告しない）
    const again = run(once, [
      { type: "success", at: T0 + 4000 },
      { type: "failure", at: T0 + 6000 },
    ]);
    expect(again.connection).toBe("ok");
  });

  it("連続して失敗しても表示中の注文を消さない。接続状態だけ変わり、最終更新は最後に成功した時刻のまま", () => {
    const before = initMonitorSync(snap("1", [order("a", "paid"), order("b", "picked_up")]), T0);
    const s = run(before, [
      { type: "request", at: T0 + 2000 },
      { type: "failure", at: T0 + 2000 },
      { type: "request", at: T0 + 4000 },
      { type: "failure", at: T0 + 4000 },
    ]);
    expect(s.snapshot.orders.map((o) => o.id)).toEqual(["a", "b"]);
    expect(s.connection).toBe("error");
    expect(s.lastSyncedAt).toBe(T0);
    expect(connectionLabel(s.connection)).toBe("更新できません。通信状況をご確認ください。");
    const retrying = run(s, [{ type: "request", at: T0 + 6000 }]);
    expect(retrying.connection).toBe("reconnecting");
    expect(connectionLabel(retrying.connection)).toBe("再接続しています…");
  });

  it("再接続: 変化がなければ（unchanged）一覧はそのまま、変化があれば最新に同期。接続表示と最終更新が戻る", () => {
    const failed = run(initMonitorSync(snap("1", [order("a", "paid")]), T0), [
      { type: "failure", at: T0 + 2000 },
      { type: "failure", at: T0 + 3000 },
    ]);
    expect(failed.connection).toBe("error");
    const unchanged = run(failed, [{ type: "success", at: T0 + 4000 }]);
    expect(unchanged.connection).toBe("ok");
    expect(unchanged.lastSyncedAt).toBe(T0 + 4000);
    expect(unchanged.snapshot.version).toBe("1");
    expect(connectionLabel(unchanged.connection)).toBe("接続中");
    const changed = run(failed, [{ type: "success", at: T0 + 4000, snapshot: snap("2", [order("a", "paid"), order("d", "paid")]) }]);
    expect(changed.snapshot.orders.map((o) => o.id)).toEqual(["a", "d"]);
  });
});

describe("受取開始が近い注文の強調（これから）", () => {
  const start = "2026-10-23T23:00:00+09:00";
  const before = (min: number) => Date.parse(start) - min * 60_000;
  it.each([
    [31, "normal", null],
    [30, "soon", "まもなく・あと30分"],
    [28, "soon", "まもなく・あと28分"],
    [16, "soon", "まもなく・あと16分"],
    [15, "imminent", "もうすぐ受取・あと15分"],
    [12, "imminent", "もうすぐ受取・あと12分"],
  ])("受取開始の %i 分前 → %s", (min, level, label) => {
    expect(startUrgency(start, before(min))).toMatchObject({ level, label });
  });
  it("秒は切り上げて分で表示する", () => {
    expect(startUrgency(start, before(12) - 30_000).label).toBe("もうすぐ受取・あと13分");
  });
});
