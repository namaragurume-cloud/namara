import { GasSource } from "./gas";
import { MockSource } from "./mock";
import type { DashboardSource, DemoControls } from "./types";

/**
 * 接続先の選択。VITE_GAS_ENDPOINT があれば GAS、なければダミーデータ。
 * 店舗IDとトークンは URL（?store=…&token=…）で渡す想定（LIFF のリンクに付ける）。
 */
export function createSource(): { source: DashboardSource; demo: DemoControls | null } {
  const endpoint = import.meta.env.VITE_GAS_ENDPOINT as string | undefined;
  const params = new URLSearchParams(window.location.search);
  if (endpoint && params.get("store") && params.get("token")) {
    return { source: new GasSource(endpoint, params.get("store")!, params.get("token")!), demo: null };
  }
  const mock = new MockSource();
  return { source: mock, demo: mock };
}
