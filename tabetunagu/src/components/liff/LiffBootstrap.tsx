"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    __tabetunaguLiff?: typeof import("@line/liff").default;
  }
}

/**
 * LIFF（LINE ミニアプリ）環境の初期化。NEXT_PUBLIC_LIFF_ID があるときだけ読み込まれる。
 * LINE アプリ内で開かれたら ID トークンをサーバーに送ってログインする。
 * 通常のブラウザでは何もしない（Web のままでも使える）。
 */
export function LiffBootstrap({ liffId, loggedIn }: { liffId: string; loggedIn: boolean }) {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { default: liff } = await import("@line/liff");
      await liff.init({ liffId });
      window.__tabetunaguLiff = liff;
      if (loggedIn || cancelled) return;
      if (!liff.isInClient() && !liff.isLoggedIn()) return;
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }
      const idToken = liff.getIDToken();
      if (!idToken) return;
      const res = await fetch("/api/auth/liff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (res.ok && !cancelled) router.refresh();
    })().catch((error) => console.error("[liff] init failed", error));
    return () => {
      cancelled = true;
    };
  }, [liffId, loggedIn, router]);
  return null;
}
