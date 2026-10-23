"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/**
 * 決済確認中の画面を数秒ごとに更新する（Webhook で paid になるのを待つ。Stripe からの戻りだけで paid にはしない）。
 * - window.opener などには依存しない（LINE 内ブラウザ・外部ブラウザのどちらでも動く）
 * - 画面が隠れている間（LINE をバックグラウンドにした等）は止め、表示が戻ったらすぐ確認する
 * - 時間がかかっても「失敗」とは表示しない。一定回数を過ぎたら、手動で確認できるボタンと注文履歴への導線を出す
 */
export function PaymentStatusPoller({ intervalMs = 3000, maxTries = 40 }: { intervalMs?: number; maxTries?: number }) {
  const router = useRouter();
  const [slow, setSlow] = useState(false);
  const [checking, startChecking] = useTransition();
  useEffect(() => {
    let tries = 0;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      tries += 1;
      router.refresh();
      if (tries >= maxTries) {
        window.clearInterval(timer);
        setSlow(true);
      }
    };
    const timer = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalMs, maxTries]);

  if (!slow) return null;
  return (
    <div className="space-y-2 rounded-2xl bg-canvas px-4 py-3 text-[13px] text-ink-2" data-testid="payment-slow">
      <p>確認に時間がかかっています。お支払いが完了していれば、このあと受取チケットが表示されます。</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => startChecking(() => router.refresh())}
          disabled={checking}
          className="min-h-[44px] rounded-full border border-line bg-paper px-4 font-semibold text-ink"
        >
          {checking ? "確認しています…" : "最新の状態を確認する"}
        </button>
        <Link href="/orders" className="flex min-h-[44px] items-center px-2 font-semibold text-forest underline">
          注文履歴を見る
        </Link>
      </div>
    </div>
  );
}
