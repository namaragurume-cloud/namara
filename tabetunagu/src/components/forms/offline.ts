"use client";

import { useState, type FormEvent } from "react";

export const OFFLINE_MESSAGE = "通信状況を確認して、もう一度お試しください。";

/**
 * 通信できないときは送信しない（白画面・技術的なエラーにしない）。オンラインに戻ったら、もう一度押してもらう。
 * 自動での再送はしない（注文・決済の作成は二重にしない。サーバー側の冪等性もそのまま）。
 */
export function useOfflineGuard() {
  const [offline, setOffline] = useState(false);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      e.preventDefault();
      setOffline(true);
      return;
    }
    setOffline(false);
  };
  return { offline, onSubmit };
}
