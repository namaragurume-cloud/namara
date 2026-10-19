/** 店舗モニターが表示するデータ（GAS API が返す JSON と同じ形） */
export type PickupStatus = "waiting" | "completed";

export type Pickup = {
  id: string;
  /** 予約番号（店頭での照合用） */
  code: string;
  /** お客様の呼び名（例: 山田様）。LINE の表示名の一部 */
  customerName: string;
  items: { name: string; qty: number }[];
  /** 受取時間（ミリ秒） */
  start: number;
  end: number;
  /** お店で支払われる金額（円） */
  total: number;
  status: PickupStatus;
  completedAt?: number;
  /** qr = お客様の店頭QRチェックイン / manual = 店舗の長押しによる手動完了 */
  completedVia?: "qr" | "manual";
};

export type Listing = { id: string; name: string; quantity: number };

export type Snapshot = {
  storeName: string;
  plan: "free" | "standard";
  listings: Listing[];
  pickups: Pickup[];
  /** 今月、今日より前に完了した成約額（円）。今日の完了分は pickups から足す */
  monthGmvBeforeToday: number;
  updatedAt: number;
};

export interface DashboardSource {
  /** 最新のスナップショットを受け取る。戻り値で購読解除 */
  subscribe(listener: (snapshot: Snapshot) => void): () => void;
  /** 長押しの手動完了（フェイルセーフ） */
  completeManually(pickupId: string): Promise<void>;
  /** 接続先の説明（画面下部に表示） */
  readonly label: string;
}

/** デモ用の操作（モックのときだけ） */
export interface DemoControls {
  simulateCheckin(): Pickup | null;
  simulateNewReservation(): Pickup | null;
  reset(): void;
}
