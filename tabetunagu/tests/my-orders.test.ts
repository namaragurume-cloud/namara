import { describe, expect, it } from "vitest";
import {
  displayStatus,
  FILTER_STATUSES,
  ORDER_STATUS_LABEL,
  orderCta,
  parseOrderFilter,
  pickupHeading,
  pickupHint,
  POINT_TYPE_LABEL,
  pointsDelta,
  upcomingPickups,
} from "@/lib/my-orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/orders";

/** マイページ・注文履歴の表示ルール（固定時刻。いつ実行しても同じ結果） */
const NOW = new Date("2026-10-23T19:45:00+09:00");
const at = (hhmm: string, day = "2026-10-23") => `${day}T${hhmm}:00+09:00`;
const order = (id: string, status: OrderStatus, start = at("19:00"), end = at("20:30")) => ({ id, status, pickupStartAt: start, pickupEndAt: end });

describe("状態の表示名（内部の status 名を出さない）", () => {
  it("すべての status にユーザー向けの名前がある", () => {
    expect(ORDER_STATUS_LABEL).toEqual({
      pending_payment: "お支払い待ち",
      paid: "受取待ち",
      picked_up: "受取完了",
      unclaimed: "未受取",
      refunded: "返金済み",
      cancelled: "キャンセル済み",
    });
    for (const s of ORDER_STATUSES) expect(ORDER_STATUS_LABEL[s]).not.toMatch(/[a-z_]/);
  });

  it("paid でも受取終了 + 猶予を過ぎていれば未受取として表示する（DB の更新前でも）", () => {
    expect(displayStatus(order("a", "paid", at("18:00"), at("19:00")), NOW)).toBe("unclaimed");
    expect(displayStatus(order("b", "paid", at("18:00"), at("19:40")), NOW)).toBe("paid"); // 猶予の間は受取待ち
    expect(displayStatus(order("c", "refunded"), NOW)).toBe("refunded");
  });
});

describe("状態ごとの CTA", () => {
  it.each([
    ["pending_payment", "決済を続ける"],
    ["paid", "受取チケットを見る"],
    ["picked_up", "注文詳細を見る"],
    ["unclaimed", "注文詳細を見る"],
    ["refunded", "返金内容を見る"],
    ["cancelled", "注文詳細を見る"],
  ] as const)("%s → %s", (status, label) => {
    expect(orderCta({ id: "o1", status, payable: true })).toEqual({ label, href: "/orders/o1" });
  });
  it("お支払いの期限が過ぎた注文には「決済を続ける」を出さない", () => {
    expect(orderCta({ id: "o1", status: "pending_payment", payable: false }).label).toBe("注文詳細を見る");
  });
});

describe("絞り込み", () => {
  it("すべて・受取待ち・完了・その他。その他は未受取・返金済み・キャンセル済み・お支払い待ち", () => {
    expect(FILTER_STATUSES.ready).toEqual(["paid"]);
    expect(FILTER_STATUSES.done).toEqual(["picked_up"]);
    expect([...FILTER_STATUSES.other].sort()).toEqual(["cancelled", "pending_payment", "refunded", "unclaimed"]);
    expect([...FILTER_STATUSES.all].sort()).toEqual([...ORDER_STATUSES].sort());
  });
  it("以前の状態ごとのタブのリンクも受け付ける", () => {
    expect(parseOrderFilter("ready")).toBe("ready");
    expect(parseOrderFilter("picked_up")).toBe("done");
    for (const t of ["pending", "unclaimed", "refunded", "cancelled"]) expect(parseOrderFilter(t)).toBe("other");
    expect(parseOrderFilter(undefined)).toBeNull();
    expect(parseOrderFilter("x")).toBeNull();
  });
});

describe("今日の受取（マイページ最上部）", () => {
  it("決済済みだけを受取開始の近い順に。受取時間を過ぎた（未受取扱い）注文と他の状態は出さない", () => {
    const list = upcomingPickups(
      [
        order("late", "paid", at("21:00"), at("22:00")),
        order("now", "paid", at("19:00"), at("20:30")),
        order("missed", "paid", at("17:00"), at("18:00")),
        order("done", "picked_up"),
        order("pending", "pending_payment"),
      ],
      NOW,
    );
    expect(list.map((o) => o.id)).toEqual(["now", "late"]);
    expect(pickupHeading(list, NOW)).toBe("今日の受取");
    expect(pickupHeading([order("t", "paid", at("12:00", "2026-10-24"), at("13:00", "2026-10-24"))], NOW)).toBe("受取待ち");
  });

  it("補助表示は受取チケットと同じ判定（受取終了まであと○分・受取開始まであと○分・受取時間を過ぎています）", () => {
    expect(pickupHint(order("a", "paid", at("19:00"), at("20:30")), NOW)).toEqual({ text: "受取終了まであと45分", urgent: true });
    expect(pickupHint(order("b", "paid", at("19:00"), at("23:30")), NOW)).toEqual({ text: "受取時間中です", urgent: false });
    expect(pickupHint(order("c", "paid", at("20:30"), at("21:30")), NOW)).toEqual({ text: "受取開始まであと45分", urgent: false });
    expect(pickupHint(order("d", "paid", at("18:00"), at("19:40")), NOW)).toEqual({ text: "受取時間を過ぎています", urgent: true });
    expect(pickupHint(order("e", "paid", at("22:30"), at("23:30")), NOW)).toBeNull(); // 60分より先は時間帯だけ
  });
});

describe("ポイント履歴の表示", () => {
  it("種別はユーザー向けの名前。増減は +30pt / -30pt", () => {
    expect(POINT_TYPE_LABEL).toEqual({ earned: "獲得", used: "利用", expired: "期限切れ", adjusted: "調整", revoked: "取消" });
    expect(pointsDelta(30)).toBe("+30pt");
    expect(pointsDelta(-30)).toBe("-30pt");
    expect(pointsDelta(1200)).toBe("+1,200pt");
  });
});
