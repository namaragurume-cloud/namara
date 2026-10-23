"use client";

import type { ReactNode } from "react";

/**
 * 「LINEでログイン」ボタン。
 * - LINE アプリ内（LIFF ブラウザ）: liff.login()（LIFF ブラウザ内で LINE Login の認可画面を直接開く動作は保証されないため）
 * - それ以外（Safari / Chrome などの外部ブラウザ）: これまでどおり Web の LINE Login（/api/auth/line）
 * LIFF が使えない・初期化前でも、通常のリンクとして動く。
 */
export function LineLoginButton({ next, className, children }: { next: string; className?: string; children: ReactNode }) {
  const href = `/api/auth/line?next=${encodeURIComponent(next)}`;
  return (
    <a
      href={href}
      className={className}
      data-testid="line-login"
      onClick={(e) => {
        const liff = window.__tabetunaguLiff;
        try {
          if (liff?.isInClient()) {
            e.preventDefault();
            liff.login({ redirectUri: new URL(next, window.location.origin).toString() });
          }
        } catch {
          // LIFF が使えなければ通常のリンク（Web の LINE Login）のまま
        }
      }}
    >
      {children}
    </a>
  );
}
