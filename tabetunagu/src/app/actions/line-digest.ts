"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin, getViewer } from "@/server/auth/viewer";
import { runFeaturedDigest, sendDigestTestToSelf, setFeaturedOptIn } from "@/server/services/line-digest";
import { toActionError, type ActionState } from "./state";

/** マイページ: 「今日の注目商品」の LINE 通知を ON / OFF（本人の明示的な操作だけ。既定は OFF） */
export async function setLineFeaturedOptInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/me");
  const on = formData.get("on") === "true";
  try {
    await setFeaturedOptIn(viewer.id, on);
  } catch (error) {
    return toActionError(error);
  }
  refresh();
  return { ok: true, message: on ? "「今日の注目商品」のLINE通知をONにしました。" : "「今日の注目商品」のLINE通知をOFFにしました。" };
}

const TEST_HINT: Record<string, string> = {
  not_enabled: "テスト送信が有効になっていません（ENABLE_LINE_MARKETING_DEMO または ENABLE_LINE_DIGEST_SEND）。",
  not_configured: "LINE_CHANNEL_ACCESS_TOKEN が未設定です。",
  not_line_user: "LINE でログインしたアカウントで操作してください。",
  no_products: "今日の注目商品がありません。",
  duplicate: "続けて送信しないよう、少し時間をおいてお試しください。",
};

/** 管理者: 自分の LINE にだけ、今日の「今夜の食べつなぎ」を1件送る */
export async function sendDigestTestAction(): Promise<ActionState> {
  try {
    const viewer = await assertAdmin();
    const r = await sendDigestTestToSelf(viewer.id);
    refresh();
    if (r.ok) return { ok: true, message: `自分のLINEへテスト送信しました（${r.products}商品）。` };
    return { ok: false, message: `テスト送信できませんでした。${TEST_HINT[r.category] ?? ""}`, code: r.category };
  } catch (error) {
    return toActionError(error);
  }
}

/** 管理者: 今日の日次通知を手動で実行する（通知を ON にしたユーザーだけ。ENABLE_LINE_DIGEST_SEND=true でなければ dry run） */
export async function runDigestNowAction(): Promise<ActionState> {
  try {
    await assertAdmin();
    const r = await runFeaturedDigest();
    refresh();
    if (r.products === 0) return { ok: true, message: "今日の注目商品がないため、誰にも送りませんでした。" };
    if (r.mode === "dry_run") return { ok: true, message: `dry run: 対象 ${r.targets}人（記録 ${r.dryRun}人・商品なし ${r.skipped}人）。LINE へは送っていません。` };
    return {
      ok: !r.aborted,
      message: `送信 ${r.sent}人・失敗 ${r.failed}人・スキップ ${r.skipped}人（対象 ${r.targets}人）。${r.aborted ? `LINE 側のエラー（${r.aborted}）のため途中で止めました。` : ""}`,
    };
  } catch (error) {
    return toActionError(error);
  }
}
