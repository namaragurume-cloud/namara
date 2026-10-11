/**
 * 計測イベントの送信。
 * GA4（NEXT_PUBLIC_GA_ID）などの計測タグが読み込まれている場合のみ送信し、
 * 未導入の場合は何もしません。別の計測サービスを使う場合はここを書き換えてください。
 *
 * 主なイベント:
 *   cta_click         … CTA ボタンのクリック（params.location / params.label）
 *   instagram_click   … Instagram / DM への遷移
 *   generate_lead     … 企業問い合わせの送信成功
 *   partner_apply     … 発信者登録申請の送信成功
 */

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function track(event: string, params: Params = {}): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", event, params);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event, ...params });
    }
  } catch {
    // 計測の失敗で操作を妨げない
  }
}
