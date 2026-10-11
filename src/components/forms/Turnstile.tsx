"use client";

import Script from "next/script";

/**
 * Cloudflare Turnstile のウィジェット。NEXT_PUBLIC_TURNSTILE_SITE_KEY が未設定なら何も表示しません。
 * 検証トークンはフォーム内の hidden input「cf-turnstile-response」に自動で入ります。
 */
export function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      <div className="cf-turnstile" data-sitekey={siteKey} data-language="ja" />
    </>
  );
}
