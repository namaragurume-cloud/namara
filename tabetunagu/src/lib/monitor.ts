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

/**
 * 受取開始が近い注文の強調（「これから」）。秒は出さない。赤（警告色）は使わない。
 *   30分超: 通常 / 30分以内: 「まもなく」/ 15分以内: 「もうすぐ受取」
 */
export type StartUrgency = { level: "normal" | "soon" | "imminent"; minutes: number; label: string | null };

export function startUrgency(pickupStartAt: string, now: number): StartUrgency {
  const minutes = Math.max(0, Math.ceil((Date.parse(pickupStartAt) - now) / MIN));
  if (minutes <= 15) return { level: "imminent", minutes, label: `もうすぐ受取・あと${minutes}分` };
  if (minutes <= 30) return { level: "soon", minutes, label: `まもなく・あと${minutes}分` };
  return { level: "normal", minutes, label: null };
}

/**
 * 区分ごとの注文。「これから」は受取開始の早い順（同じ時刻はサーバーの並び = 作成順で固定）。
 * 区分の判定には呼び出し側の1つの現在時刻を使う。
 */
export function monitorSections(orders: MonitorOrder[], now: number) {
  const out: Record<PickupPhase, MonitorOrder[]> = { active: [], upcoming: [], picked_up: [], unclaimed: [] };
  orders.forEach((o) => out[pickupPhase(o, now)].push(o));
  const index = new Map(orders.map((o, i) => [o.id, i]));
  out.upcoming.sort((a, b) => Date.parse(a.pickupStartAt) - Date.parse(b.pickupStartAt) || index.get(a.id)! - index.get(b.id)!);
  return out;
}

/** 「受取完了」の欄に最初から出す件数（新しい順。それより古いものは折りたたむ） */
export const PICKED_UP_VISIBLE = 8;

/** 受取完了の新しい順（受取時刻の新しい順、同じなら注文の並び順） */
export function recentPickups(pickedUp: MonitorOrder[]) {
  const index = new Map(pickedUp.map((o, i) => [o.id, i]));
  return [...pickedUp].sort((a, b) => Date.parse(b.pickedUpAt ?? "") - Date.parse(a.pickedUpAt ?? "") || index.get(a.id)! - index.get(b.id)!);
}

/** 受取時間中（今受取できます）の補足。受取終了を過ぎたが遅めの猶予の間は「受取時間を過ぎています」 */
export function activeNote(o: Pick<MonitorOrder, "pickupEndAt">, now: number): string | null {
  return now > Date.parse(o.pickupEndAt) ? "受取時間を過ぎています" : null;
}

/** 次の受取予定（これからの最初の受取開始時刻）。なければ null */
export function nextPickupStart(upcoming: MonitorOrder[]): string | null {
  return upcoming.length ? upcoming[0].pickupStartAt : null;
}
