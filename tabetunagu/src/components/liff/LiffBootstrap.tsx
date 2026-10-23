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
 * 外部ブラウザ（Safari / Chrome）では自動でログインしない（withLoginOnExternalBrowser は使わない）:
 *   LINE を使わない人も商品を見られるようにし、購入など必要なときだけ「LINEでログイン」へ案内する（LINE MINI App の外部ブラウザの推奨どおり）。
 * liff.init() は「liff.state」（miniapp.line.me/<LIFF ID>/<パス> で開いたときの遷移先）の処理も行う。
 */
const RETRY_KEY = "tabetunagu.liff.relogin";

/** 再ログインは10分に1回まで（同じ画面で何度もログイン画面に戻らないように） */
function shouldRetryLogin() {
  try {
    const last = Number(window.sessionStorage.getItem(RETRY_KEY) ?? 0);
    if (Date.now() - last < 10 * 60_000) return false;
    window.sessionStorage.setItem(RETRY_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

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
      if (res.ok) {
        if (!cancelled) router.refresh();
        return;
      }
      // ID トークンの期限切れなど（401）: LINE アプリ内なら一度だけログインし直す（無限ループにしない）
      if (res.status === 401 && liff.isInClient() && shouldRetryLogin()) {
        liff.logout();
        liff.login({ redirectUri: window.location.href });
      }
    })().catch(() => {
      // LIFF が使えない環境（外部ブラウザの設定・通信エラー等）でもページは通常どおり動かす。トークン等はログに出さない
      console.warn("[liff] init skipped");
    });
    return () => {
      cancelled = true;
    };
  }, [liffId, loggedIn, router]);
  return null;
}
