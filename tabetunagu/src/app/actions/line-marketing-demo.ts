"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/server/auth/viewer";
import { sendFeaturedProductDemo, type MarketingErrorCategory } from "@/server/services/line-marketing";
import { toActionError, type ActionState } from "./state";

/** 失敗時の補足（技術的な内容は出さない。詳細はサーバーのログだけ） */
const HINT: Partial<Record<MarketingErrorCategory, string>> = {
  not_enabled: "このデモは有効になっていません。",
  not_line_user: "LINE でログインしたアカウントで操作してください。",
  product_not_found: "公開中の商品を選んでください。",
  duplicate: "続けて送信しないよう、少し時間をおいてお試しください。",
};

/** 管理者が自分自身の LINE に「今日の食べつなぎ」を1件送る（デモ。Broadcast はしない） */
export async function sendFeaturedProductDemoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const viewer = await assertAdmin();
    const productId = z.string().uuid().safeParse(formData.get("productId"));
    if (!productId.success) return { ok: false, message: `LINEテスト通知を送信できませんでした。${HINT.product_not_found}` };
    const result = await sendFeaturedProductDemo(viewer.id, productId.data);
    refresh();
    if (result.ok) return { ok: true, message: "LINEへテスト通知を送信しました。" };
    return { ok: false, message: `LINEテスト通知を送信できませんでした。${HINT[result.category] ?? ""}`, code: result.category };
  } catch (error) {
    return toActionError(error);
  }
}
