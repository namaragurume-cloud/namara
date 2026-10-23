"use server";

import { assertStoreMember } from "@/server/auth/viewer";
import { logEvent } from "@/server/services/events";

/** 店舗モニターの操作の記録（分析用）。店舗メンバーのみ。個人情報は残さない。失敗しても画面は止めない */
export async function logMonitorUsageAction(storeId: string, kind: "sound_enabled" | "fullscreen_enabled"): Promise<void> {
  try {
    const { viewer } = await assertStoreMember(storeId);
    await logEvent(kind === "sound_enabled" ? "monitor_sound_enabled" : "monitor_fullscreen_enabled", { userId: viewer.id, storeId });
  } catch {
    // 記録できなくてもモニターの操作には影響させない
  }
}
