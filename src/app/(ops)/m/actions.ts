"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/ops/db";
import { findCreatorByToken, recordResponse } from "@/lib/ops/service";

const ymd = /^\d{4}-\d{2}-\d{2}$/;

async function load(token: string, id: string) {
  const creator = await findCreatorByToken(token);
  const a = creator ? await db.get("assignments", id) : null;
  if (!creator || !a || a.creatorId !== creator.id) redirect("/");
  const campaign = await db.get("campaigns", a.campaignId);
  if (!campaign) redirect("/");
  return { creator, a, campaign };
}

function back(token: string, id: string, flash: string): never {
  redirect(`/m/${token}/${id}?flash=${encodeURIComponent(flash)}`);
}

export async function respond(token: string, id: string, fd: FormData) {
  const { a, campaign } = await load(token, id);
  if (campaign.reportSentAt) back(token, id, "!この案件は終了しています");
  const accept = fd.get("answer") === "yes";
  const slotIds = fd.getAll("slot").map(String);
  const plannedPostDate = String(fd.get("plannedPostDate") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 500) || undefined;
  if (fd.get("answer") !== "yes" && fd.get("answer") !== "no") back(token, id, "!参加するかどうかを選んでください");
  if (accept && !a.confirmedNotifiedAt && slotIds.length === 0) back(token, id, "!参加できる日時を1つ以上選んでください");
  if (plannedPostDate && !ymd.test(plannedPostDate)) back(token, id, "!投稿日の形式が正しくありません");
  const postDates = campaign.postDates ?? [];
  if (accept && postDates.length) {
    if (!plannedPostDate && !a.confirmedNotifiedAt) back(token, id, "!投稿日をカレンダーから選んでください");
    if (plannedPostDate && !postDates.includes(plannedPostDate) && plannedPostDate !== a.plannedPostDate) back(token, id, "!投稿日は色のついた日から選んでください");
  }
  await recordResponse(a, campaign, { accept, slotIds, plannedPostDate: plannedPostDate || undefined, note });
  back(token, id, accept ? "回答ありがとうございます！撮影日が決まったらお知らせします。" : "ご回答ありがとうございました。またよろしくお願いします！");
}

/** 投稿URL（任意） */
export async function savePostUrl(token: string, id: string, fd: FormData) {
  const { a } = await load(token, id);
  const url = String(fd.get("postUrl") ?? "").trim();
  if (url && !z.url().safeParse(url).success) back(token, id, "!URLの形式が正しくありません");
  await db.update("assignments", a.id, (x) => ({ ...x, postUrl: url || undefined }));
  back(token, id, "投稿URLを保存しました");
}
