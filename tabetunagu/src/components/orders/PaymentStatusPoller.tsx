"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 決済確認中の画面を数秒ごとに更新する（Webhook で paid になるのを待つ）。
 * window.opener などには依存しない（LINE 内ブラウザでも動く）。
 */
export function PaymentStatusPoller({ intervalMs = 3000, maxTries = 40 }: { intervalMs?: number; maxTries?: number }) {
  const router = useRouter();
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      router.refresh();
      if (tries >= maxTries) window.clearInterval(timer);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [router, intervalMs, maxTries]);
  return null;
}
