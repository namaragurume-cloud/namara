import type { DashboardSource, DemoControls, Listing, Pickup, Snapshot } from "./types";

/** 動作確認用のダミーデータ（架空の「大通ベーカリー」）。時刻は「いま」を基準に作る */
const MIN = 60_000;
const PRODUCTS = {
  box: { name: "パンBOX", price: 800 },
  baguette: { name: "バゲット", price: 250 },
  loaf: { name: "食パン", price: 300 },
} as const;
const NAMES = ["山田", "佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "中村", "小林", "加藤", "吉田", "山本"];

function code() {
  const a = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join("");
}

function slot(offsetMin: number) {
  const base = Math.floor(Date.now() / (30 * MIN)) * 30 * MIN;
  const start = base + offsetMin * MIN;
  return { start, end: start + 30 * MIN };
}

function pickup(i: number, offsetMin: number, items: [keyof typeof PRODUCTS, number][], done: boolean): Pickup {
  const { start, end } = slot(offsetMin);
  return {
    id: `p${i}`,
    code: code(),
    customerName: `${NAMES[i % NAMES.length]}様`,
    items: items.map(([k, qty]) => ({ name: PRODUCTS[k].name, qty })),
    start,
    end,
    total: items.reduce((s, [k, qty]) => s + PRODUCTS[k].price * qty, 0),
    status: done ? "completed" : "waiting",
    completedAt: done ? start + 10 * MIN : undefined,
    completedVia: done ? "qr" : undefined,
  };
}

function initial(): Snapshot {
  const listings: Listing[] = [
    { id: "l1", name: "パンBOX", quantity: 8 },
    { id: "l2", name: "バゲット", quantity: 5 },
    { id: "l3", name: "食パン", quantity: 3 },
  ];
  const pickups: Pickup[] = [
    pickup(0, -90, [["box", 1]], true),
    pickup(1, -60, [["baguette", 2]], true),
    pickup(2, -60, [["box", 1]], false), // 受取時間を過ぎても来店していない例
    pickup(3, -30, [["box", 1], ["loaf", 1]], true),
    pickup(4, 0, [["box", 1]], false),
    pickup(5, 0, [["baguette", 1]], false),
    pickup(6, 30, [["box", 2]], false),
    pickup(7, 60, [["loaf", 1]], false),
  ];
  return { storeName: "大通ベーカリー", plan: "free", listings, pickups, monthGmvBeforeToday: 118_200, updatedAt: Date.now() };
}

export class MockSource implements DashboardSource, DemoControls {
  readonly label = "デモデータ（ダミー）";
  private snapshot: Snapshot = initial();
  private listeners = new Set<(s: Snapshot) => void>();
  private seq = 100;

  subscribe(listener: (s: Snapshot) => void) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(next: Snapshot) {
    this.snapshot = { ...next, updatedAt: Date.now() };
    this.listeners.forEach((l) => l(this.snapshot));
  }

  private complete(id: string, via: "qr" | "manual") {
    const target = this.snapshot.pickups.find((p) => p.id === id && p.status === "waiting");
    if (!target) return null;
    const done: Pickup = { ...target, status: "completed", completedAt: Date.now(), completedVia: via };
    this.emit({ ...this.snapshot, pickups: this.snapshot.pickups.map((p) => (p.id === id ? done : p)) });
    return done;
  }

  async completeManually(id: string) {
    await new Promise((r) => setTimeout(r, 250)); // 通信の待ち時間を再現
    this.complete(id, "manual");
  }

  /** お客様が店頭QRを読み取った（受取時間が早い順に1件） */
  simulateCheckin() {
    const next = this.snapshot.pickups.filter((p) => p.status === "waiting").sort((a, b) => a.start - b.start)[0];
    return next ? this.complete(next.id, "qr") : null;
  }

  /** 新しい予約が入った（残りがあるときだけ） */
  simulateNewReservation() {
    const reserved = this.snapshot.pickups.reduce((s, p) => s + p.items.reduce((t, i) => t + i.qty, 0), 0);
    const listed = this.snapshot.listings.reduce((s, l) => s + l.quantity, 0);
    if (reserved >= listed) return null;
    const last = Math.max(...this.snapshot.pickups.map((p) => p.start));
    const p = pickup(this.seq++, Math.round((last - slot(0).start) / MIN) + 30, [["box", 1]], false);
    this.emit({ ...this.snapshot, pickups: [...this.snapshot.pickups, { ...p, id: `n${this.seq}` }] });
    return p;
  }

  reset() {
    this.emit(initial());
  }
}
