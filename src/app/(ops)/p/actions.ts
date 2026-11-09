"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/ops/db";
import { findCampaignByShareToken } from "@/lib/ops/service";
import { shopDecide, VideoError } from "@/lib/ops/video";

/** 飲食店が動画を確認（OK／修正） */
export async function shopVideoDecision(shareToken: string, assignmentId: string, versionId: string, fd: FormData) {
  const ok = fd.get("decision") === "ok";
  const go = (flash: string): never => redirect(`/p/${shareToken}?flash=${encodeURIComponent(flash)}#video`);
  const c = await findCampaignByShareToken(shareToken);
  const a = c ? await db.get("assignments", assignmentId) : null;
  if (!c || !a || a.campaignId !== c.id) go("!この動画は確認できません");
  const comment = String(fd.get("comment") ?? "").trim().slice(0, 1000) || undefined;
  const name = String(fd.get("name") ?? "").trim().slice(0, 40) || undefined;
  if (!ok && !comment) go("!修正してほしい内容をご記入ください");
  try {
    await shopDecide(assignmentId, versionId, ok, comment, "shop", name);
  } catch (e) {
    if (e instanceof VideoError) go(`!${e.message}`);
    throw e;
  }
  go(ok ? "ありがとうございます！発信者に「OK」をお伝えしました。" : "ありがとうございます。発信者に修正内容をお伝えしました。修正版が届いたら、またこちらに表示されます。");
}
