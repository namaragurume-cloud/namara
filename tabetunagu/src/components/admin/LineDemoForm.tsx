"use client";

import { useActionState, useEffect, useState } from "react";
import { sendLineDemoAction } from "@/app/actions/line-demo";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

/**
 * 「LINEテスト通知を送る」。LINE アプリ内（LIFF）で開いているときは、押した操作で LIFF アクセストークンを取り、
 * サーバーでサービス通知トークンに交換してから送る（トークンは画面に表示せず、ブラウザにも保存しない）。
 */
export function LineDemoForm() {
  const [state, action] = useActionState(sendLineDemoAction, null);
  const [inClient, setInClient] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => {
      try {
        setInClient(Boolean(window.__tabetunaguLiff?.isInClient()));
      } catch {
        setInClient(false);
      }
    };
    check();
    const t = window.setTimeout(check, 1500); // LIFF の初期化を待つ
    return () => window.clearTimeout(t);
  }, []);

  return (
    <form
      action={(fd) => {
        try {
          const liff = window.__tabetunaguLiff;
          const token = liff?.isLoggedIn() ? liff.getAccessToken() : null;
          if (token) fd.set("liffAccessToken", token);
        } catch {
          // LIFF が使えない環境では保存済みのトークンで送る（なければ案内を表示）
        }
        return action(fd);
      }}
      className="space-y-3"
    >
      <p className="text-[12.5px] text-ink-2" data-testid="line-demo-env">
        {inClient === null ? "LINE アプリ内かどうかを確認しています…" : inClient ? "LINE アプリ内（LINE ミニアプリ）で開いています。" : "LINE アプリの外で開いています。新しく通知を許可するには LINE アプリ内で開いてください。"}
      </p>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
      <SubmitButton size="lg" pendingLabel="送信しています…" data-testid="line-demo-send">
        LINEテスト通知を送る
      </SubmitButton>
    </form>
  );
}
