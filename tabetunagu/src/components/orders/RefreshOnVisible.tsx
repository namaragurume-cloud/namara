"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * 画面が隠れていた（LINE をバックグラウンドにした・別のアプリを開いた等）あとに表示が戻ったら、
 * サーバーの最新の状態で描き直す（受取チケットの状態・受取時間の区分が古いまま固定されないように）。
 * 短い切り替え（minHiddenMs 未満）では取り直さない。GET の描き直しだけで、操作の再送はしない。
 */
export function RefreshOnVisible({ minHiddenMs = 30_000 }: { minHiddenMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null && Date.now() - hiddenAt >= minHiddenMs) {
        hiddenAt = null;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onChange);
    window.addEventListener("pageshow", onChange);
    return () => {
      document.removeEventListener("visibilitychange", onChange);
      window.removeEventListener("pageshow", onChange);
    };
  }, [router, minHiddenMs]);
  return null;
}
