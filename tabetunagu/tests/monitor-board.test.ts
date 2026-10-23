import { describe, expect, it } from "vitest";
import { wakeLockStatus } from "@/components/monitor/kiosk";
import { activeNote, monitorSections, nextPickupStart, PICKED_UP_VISIBLE, recentPickups, type MonitorOrder } from "@/lib/monitor";

/** 店舗モニターの表示ルール（固定時刻。いつ実行しても同じ結果） */
const NOW = Date.parse("2026-10-23T19:00:00+09:00");
const at = (hhmm: string) => `2026-10-23T${hhmm}:00+09:00`;

function order(id: string, o: Partial<MonitorOrder>): MonitorOrder {
  return {
    id,
    orderNumber: id.toUpperCase(),
    status: "paid",
    customerName: "デ＊＊＊ 様",
    items: [{ name: "BOX", quantity: 1 }],
    pickupStartAt: at("18:00"),
    pickupEndAt: at("20:00"),
    pickedUpAt: null,
    phase: "active",
    ...o,
  };
}

describe("区分と並び順", () => {
  it("受取時間中・これから・受取完了・未受取に分ける。これからは受取開始の早い順", () => {
    const s = monitorSections(
      [
        order("late", { pickupStartAt: at("21:00"), pickupEndAt: at("22:00") }),
        order("soon", { pickupStartAt: at("19:20"), pickupEndAt: at("20:00") }),
        order("now", {}),
        order("done", { status: "picked_up", pickedUpAt: at("18:30") }),
        order("missed", { pickupStartAt: at("16:00"), pickupEndAt: at("17:00") }),
      ],
      NOW,
    );
    expect(s.active.map((o) => o.id)).toEqual(["now"]);
    expect(s.upcoming.map((o) => o.id)).toEqual(["soon", "late"]);
    expect(s.picked_up.map((o) => o.id)).toEqual(["done"]);
    expect(s.unclaimed.map((o) => o.id)).toEqual(["missed"]);
    expect(nextPickupStart(s.upcoming)).toBe(at("19:20"));
    expect(nextPickupStart([])).toBeNull();
  });

  it("受取完了は新しい順。最初に出すのは8件（それ以外は折りたたむ）", () => {
    const list = Array.from({ length: 12 }, (_, i) => order(`p${i}`, { status: "picked_up", pickedUpAt: at(`18:${String(10 + i).padStart(2, "0")}`) }));
    const sorted = recentPickups(list);
    expect(sorted[0].id).toBe("p11");
    expect(sorted.at(-1)!.id).toBe("p0");
    expect(PICKED_UP_VISIBLE).toBeGreaterThanOrEqual(5);
    expect(PICKED_UP_VISIBLE).toBeLessThanOrEqual(10);
    expect(sorted.slice(PICKED_UP_VISIBLE)).toHaveLength(12 - PICKED_UP_VISIBLE);
  });
});

describe("受取時間を過ぎた注文（遅めの猶予の間）", () => {
  it("受取終了を過ぎても猶予の間は「今受取できます」に残し「受取時間を過ぎています」と添える", () => {
    const o = order("g", { pickupStartAt: at("18:00"), pickupEndAt: at("18:50") });
    expect(monitorSections([o], NOW).active).toHaveLength(1);
    expect(activeNote(o, NOW)).toBe("受取時間を過ぎています");
    expect(activeNote(order("n", {}), NOW)).toBeNull();
    // 猶予（15分）を過ぎたら未受取
    expect(monitorSections([order("x", { pickupEndAt: at("18:44") })], NOW).unclaimed).toHaveLength(1);
  });
});

describe("画面スリープ防止の状態", () => {
  it("ON / OFF / 非対応", () => {
    const nav = { wakeLock: { request: async () => ({ released: false, release: async () => {} }) } };
    expect(wakeLockStatus(nav, { released: false, release: async () => {} }, true)).toBe("on");
    expect(wakeLockStatus(nav, null, false)).toBe("off");
    expect(wakeLockStatus({}, null, true)).toBe("unsupported");
    // 対応していても拒否された（取得できなかった）場合は非対応として案内する
    expect(wakeLockStatus(nav, null, true)).toBe("unsupported");
  });
});
