"use server";

import { refresh } from "next/cache";
import type { ServiceMessageErrorCategory } from "@/lib/service-message";
import { assertAdmin } from "@/server/auth/viewer";
import { env } from "@/server/env";
import { sendDemoOrderCompleted } from "@/server/services/line-notifications";
import { toActionError, type ActionState } from "./state";

/** 失敗時の補足（技術的な内容・トークンは出さない。詳細はサーバーのログだけ） */
const HINT: Partial<Record<ServiceMessageErrorCategory, string>> = {
  not_enabled: "このデモは有効になっていません。",
  not_configured: "通知のテンプレートが設定されていません。",
  not_line_user: "LINE でログインしたアカウントで、LINE アプリ内から操作してください。",
  no_token: "LINE アプリ内（LINE ミニアプリ）で開いてから、もう一度押してください。",
  duplicate: "続けて送信しないよう、1分ほど待ってからお試しください。",
};

/**
 * 管理者が自分自身の LINE に「注文完了」のサービスメッセージを1件送る（デモ）。
 * 本番では無効（env.line.serviceMessageDemoEnabled）。LIFF アクセストークンはこの処理の中でだけ使い、保存しない。
 */
export async function sendLineDemoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const viewer = await assertAdmin();
    if (!env.line.serviceMessageDemoEnabled) return { ok: false, message: `LINE通知を送信できませんでした。${HINT.not_enabled}` };
    const raw = String(formData.get("liffAccessToken") ?? "");
    const liffAccessToken = raw && raw.length <= 4096 ? raw : null;
    const result = await sendDemoOrderCompleted(viewer.id, liffAccessToken);
    refresh();
    if (result.ok) return { ok: true, message: "LINEへテスト通知を送信しました。" };
    return { ok: false, message: `LINE通知を送信できませんでした。${HINT[result.category] ?? ""}`, code: result.category };
  } catch (error) {
    return toActionError(error);
  }
}
