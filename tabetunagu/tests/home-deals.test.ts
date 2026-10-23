import { describe, expect, it } from "vitest";
import { discountOf, ENDING_SOON_MINUTES, homeSections, isPurchasable, pickupDeadline, remainingLabel } from "@/lib/deals";
import type { ProductCard } from "@/lib/types";

const NOW = new Date("2026-10-23T10:00:00Z"); // JST 19:00
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();

let seq = 0;
function product(patch: Partial<ProductCard> = {}): ProductCard {
  seq += 1;
  return {
    id: `p${seq}`,
    name: `商品${seq}`,
    description: "",
    imageUrl: null,
    category: "bread",
    isBox: false,
    originalPrice: 1000,
    rescuePrice: 500,
    quantity: 5,
    remaining: 3,
    maxPerReservation: 2,
    pickupStartAt: at(-30),
    pickupEndAt: at(180),
    status: "published",
    storeId: "s1",
    storeName: "店",
    storeSlug: "store",
    areaId: "odori",
    plan: "free",
    ...patch,
  };
}

describe("お得表示（discountOf）", () => {
  it("元価格（○円相当）が販売価格より高いときだけ、お得率（切り捨て）とお得額を返す", () => {
    expect(discountOf(2400, 1200)).toEqual({ rate: 50, amount: 1200 });
    expect(discountOf(1400, 750)).toEqual({ rate: 46, amount: 650 }); // 46.4% → 46
    expect(discountOf(1000, 0)).toEqual({ rate: 100, amount: 1000 });
  });
  it("不正な値（元価格なし・0以下・販売価格以下・NaN・負の価格・1%未満）は表示しない", () => {
    expect(discountOf(null, 500)).toBeNull();
    expect(discountOf(undefined, 500)).toBeNull();
    expect(discountOf(0, 500)).toBeNull();
    expect(discountOf(-100, 50)).toBeNull();
    expect(discountOf(500, 500)).toBeNull();
    expect(discountOf(400, 500)).toBeNull();
    expect(discountOf(Number.NaN, 500)).toBeNull();
    expect(discountOf(1000, -1)).toBeNull();
    expect(discountOf(10000, 9999)).toBeNull(); // 0.01%
  });
});

describe("残り数量（remainingLabel）", () => {
  it("BOX は「残り3BOX」、単品は「残り3点」、在庫1は「残り1つ」（強調）、在庫0は出さない", () => {
    expect(remainingLabel(3, true)).toEqual({ text: "残り3BOX", last: false });
    expect(remainingLabel(3, false)).toEqual({ text: "残り3点", last: false });
    expect(remainingLabel(1, true)).toEqual({ text: "残り1つ", last: true });
    expect(remainingLabel(0, true)).toBeNull();
    expect(remainingLabel(-1, false)).toBeNull();
  });
});

describe("受取終了までの表示（pickupDeadline）", () => {
  it("60分以内は「あと○分」、それより先は「HH:MMまで」（JST）、終了済みは出さない", () => {
    expect(pickupDeadline(at(45), NOW)).toEqual({ label: "あと45分", soon: true, minutesLeft: 45 });
    expect(pickupDeadline(at(60), NOW)).toMatchObject({ label: "あと60分", soon: true });
    expect(pickupDeadline(at(61), NOW)).toMatchObject({ label: "20:01まで", soon: false });
    expect(pickupDeadline(at(270), NOW)).toMatchObject({ label: "23:30まで", soon: false });
    expect(pickupDeadline(at(0), NOW)).toBeNull();
    expect(pickupDeadline(at(-5), NOW)).toBeNull();
  });
});

describe("ホームのセクション（homeSections）", () => {
  it("購入可能件数: 公開中・在庫あり・受取終了前だけを数える（売り切れ・在庫0・終了済みは除く）。受取開始済みの数も返す", () => {
    const items = [
      product(),
      product({ pickupStartAt: at(30) }),
      product({ status: "sold_out", remaining: 0 }),
      product({ remaining: 0 }),
      product({ pickupEndAt: at(-1) }),
    ];
    const s = homeSections(items, NOW);
    expect(s.available.map((p) => p.id)).toEqual([items[0].id, items[1].id]);
    expect(s.readyNow).toBe(1);
    expect(isPurchasable(items[4], NOW)).toBe(false);
  });

  it("エリアで絞り込む", () => {
    const items = [product({ areaId: "odori" }), product({ areaId: "susukino" })];
    expect(homeSections(items, NOW, "susukino").available.map((p) => p.areaId)).toEqual(["susukino"]);
  });

  it(`まもなく受取終了: 受取終了まで${ENDING_SOON_MINUTES}分以内だけ・終了が近い順・最大5件。ないときは空（セクションごと出さない）`, () => {
    const soon = [40, 10, 80, 30, 50, 20].map((m) => product({ pickupEndAt: at(m) }));
    const later = product({ pickupEndAt: at(ENDING_SOON_MINUTES + 1) });
    const s = homeSections([...soon, later], NOW);
    expect(s.endingSoon.map((p) => Date.parse(p.pickupEndAt))).toEqual([10, 20, 30, 40, 50].map((m) => Date.parse(at(m))));
    expect(s.endingSoon).not.toContain(later);
    expect(homeSections([later], NOW).endingSoon).toEqual([]);
  });

  it("おすすめは取得時の並び（STANDARD 優先など）のまま、最大6件。同じ商品を複数のセクションに出さない。BOX は BOX だけ", () => {
    const items = [
      product({ plan: "standard", isBox: true }),
      product({ isBox: true, pickupEndAt: at(30) }),
      ...Array.from({ length: 6 }, () => product()),
      product({ isBox: true }),
    ];
    const s = homeSections(items, NOW);
    expect(s.recommended).toHaveLength(6);
    expect(s.recommended[0].plan).toBe("standard");
    expect(s.endingSoon.map((p) => p.id)).toEqual([items[1].id]);
    const ids = [...s.recommended, ...s.endingSoon, ...s.boxes].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(s.boxes.every((p) => p.isBox)).toBe(true);
    expect(s.boxes.map((p) => p.id)).toEqual([items[8].id]);
  });

  it("空状態: 購入可能な商品がなければすべて空", () => {
    const s = homeSections([product({ status: "sold_out", remaining: 0 })], NOW);
    expect(s).toMatchObject({ available: [], readyNow: 0, recommended: [], endingSoon: [], boxes: [] });
  });
});
