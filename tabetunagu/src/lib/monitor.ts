import { ORDER_POLICY } from "./orders";

/**
 * 店舗モニター・受取チケットの共通ロジック（サーバー・ブラウザの両方で使う純粋関数）。
 */
export type PickupPhase = "upcoming" | "active" | "picked_up" | "unclaimed";

export type MonitorOrder = {
  id: string;
  orderNumber: string;
  status: "paid" | "picked_up" | "unclaimed";
  customerName: string;
  items: { name: string; quantity: number }[];
  pickupStartAt: string;
  pickupEndAt: string;
  pickedUpAt: string | null;
  phase: PickupPhase;
};

export type MonitorSnapshot = {
  storeId: string;
  storeName: string;
  generatedAt: string;
  /** 内容が変わったときだけ変わる値（ポーリングの差分判定用） */
  version: string;
  orders: MonitorOrder[];
};

const MIN = 60_000;

/** 受取完了（スワイプ）できる時間帯 */
export function pickupWindow(startAt: string, endAt: string, policy = ORDER_POLICY) {
  return {
    opensAt: Date.parse(startAt) - policy.pickupEarlyGraceMinutes * MIN,
    closesAt: Date.parse(endAt) + policy.pickupLateGraceMinutes * MIN,
  };
}

/**
 * 表示上の区分。paid でも受取終了 + 猶予を過ぎていれば（DB の更新前でも）未受取として扱う。
 */
export function pickupPhase(
  o: { status: string; pickupStartAt: string; pickupEndAt: string },
  now: number,
  policy = ORDER_POLICY,
): PickupPhase {
  if (o.status === "picked_up") return "picked_up";
  if (o.status === "unclaimed") return "unclaimed";
  const { opensAt, closesAt } = pickupWindow(o.pickupStartAt, o.pickupEndAt, policy);
  if (now > closesAt) return "unclaimed";
  if (now >= opensAt) return "active";
  return "upcoming";
}

/**
 * 新しく受取完了になった注文を検出する（通知音用）。
 * known が null（初回表示）のときは、既に受取完了の注文を記録するだけで音は鳴らさない。
 * 同じ注文は一度しか検出しない。
 */
export function detectNewPickups(known: ReadonlySet<string> | null, orders: Pick<MonitorOrder, "id" | "status">[]) {
  const pickedUp = orders.filter((o) => o.status === "picked_up").map((o) => o.id);
  const next = new Set(known ?? []);
  const fresh: string[] = [];
  for (const id of pickedUp) {
    if (!next.has(id)) {
      next.add(id);
      if (known !== null) fresh.push(id);
    }
  }
  return { fresh, known: next };
}
