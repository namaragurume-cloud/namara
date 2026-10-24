"use client";

import { useActionState, useEffect, useState } from "react";
import { sendFeaturedProductDemoAction } from "@/app/actions/line-marketing-demo";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

/** 「自分にテスト送信」（送信先はログイン中の自分だけ。Broadcast のボタンは置かない） */
export function FeaturedDemoForm({ productId }: { productId: string }) {
  const [state, action] = useActionState(sendFeaturedProductDemoAction, null);
  const [friend, setFriend] = useState<"yes" | "no" | "unknown">("unknown");
  useEffect(() => {
    // LINE アプリ内なら、LINE 公式アカウントを友だち追加しているかを表示する（Push を受け取るのに必要）
    const t = window.setTimeout(async () => {
      try {
        const liff = window.__tabetunaguLiff;
        if (!liff?.isLoggedIn()) return;
        const r = await liff.getFriendship();
        setFriend(r.friendFlag ? "yes" : "no");
      } catch {
        setFriend("unknown");
      }
    }, 1000);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <p className="text-[12.5px] text-ink-2" data-testid="featured-demo-friend">
        {friend === "yes"
          ? "TABETUNAGU の LINE 公式アカウントを友だち追加しています。"
          : friend === "no"
            ? "LINE 公式アカウントを友だち追加していません。友だち追加してから送信してください。"
            : "友だち追加の状態は LINE アプリ内で開くと確認できます（受け取るには友だち追加が必要です）。"}
      </p>
      {state && <Notice tone={state.ok ? "success" : "error"}>{state.message}</Notice>}
      <SubmitButton size="lg" pendingLabel="送信しています…" data-testid="featured-demo-send">
        自分にテスト送信
      </SubmitButton>
    </form>
  );
}
