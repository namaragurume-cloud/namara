/**
 * 計測イベントの送信。
 * GA4（NEXT_PUBLIC_GA_ID）などの計測タグが読み込まれている場合のみ送信し、
 * 未導入の場合は何もしません。別の計測サービスを使う場合はここを書き換えてください。
 *
 * 主なイベント:
 *   cta_click          … 問い合わせ CTA のクリック（params.location で設置場所を識別）
 *                        例: hero / header / sticky_mobile / pricing_single / creator_card
 *   contact_form_view  … お問い合わせページの表示（params.budget / from_creator で流入元を識別）
 *   generate_lead      … 企業問い合わせの送信成功（サーバーで送信に成功した場合のみ）
 *   partner_apply      … 発信者登録申請の送信成功
 *   instagram_click    … Instagram / DM への遷移
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
