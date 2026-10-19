import type { DashboardSource, Snapshot } from "./types";

/**
 * Google Apps Script（ウェブアプリ）から読み込むデータソース。
 * GAS はサーバーからの push ができないため、一定間隔でポーリングする。
 *
 *   GET  {endpoint}?action=dashboard&store={storeId}&token={token}  → Snapshot（JSON）
 *   POST {endpoint}  body: {"action":"complete","store":…,"token":…,"pickupId":…,"via":"manual"}
 *
 * POST は CORS のプリフライトを避けるため Content-Type: text/plain で送る（GAS の doPost で JSON.parse する）。
 * LINE Messaging API の Webhook（お客様の QR チェックイン）は GAS 側でシートを更新し、次のポーリングで画面に反映される。
 */
export class GasSource implements DashboardSource {
  readonly label: string;
  private listeners = new Set<(s: Snapshot) => void>();
  private timer: number | undefined;
  private last: Snapshot | null = null;

  constructor(
    private endpoint: string,
    private storeId: string,
    private token: string,
    private intervalMs = 10_000,
  ) {
    this.label = `GAS（${intervalMs / 1000}秒ごとに更新）`;
  }

  private async poll() {
    try {
      const url = new URL(this.endpoint);
      url.searchParams.set("action", "dashboard");
      url.searchParams.set("store", this.storeId);
      url.searchParams.set("token", this.token);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.last = (await res.json()) as Snapshot;
      this.listeners.forEach((l) => l(this.last!));
    } catch (error) {
      console.error("[gas] poll failed", error);
    }
  }

  subscribe(listener: (s: Snapshot) => void) {
    this.listeners.add(listener);
    if (this.last) listener(this.last);
    if (this.timer === undefined) {
      void this.poll();
      this.timer = window.setInterval(() => void this.poll(), this.intervalMs);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.timer !== undefined) {
        window.clearInterval(this.timer);
        this.timer = undefined;
      }
    };
  }

  async completeManually(pickupId: string) {
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "complete", store: this.storeId, token: this.token, pickupId, via: "manual" }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await this.poll();
  }
}
