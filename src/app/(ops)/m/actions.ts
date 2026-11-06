"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/ops/db";
import { findCreatorByToken, recordInsight, recordResponse } from "@/lib/ops/service";

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
  if (plannedPostDate && !ymd.test(plannedPostDate)) back(token, id, "!投稿予定日の形式が正しくありません");
  await recordResponse(a, campaign, { accept, slotIds, plannedPostDate: plannedPostDate || undefined, note });
  back(token, id, accept ? "回答ありがとうございます！撮影日が決まったらお知らせします。" : "ご回答ありがとうございました。またよろしくお願いします！");
}

const insightSchema = z.object({
  postUrl: z.url({ error: "投稿のURLを入力してください" }).max(500),
  views: z.coerce.number().int().min(0).max(1e9),
  reach: z.coerce.number().int().min(0).max(1e9),
  likes: z.coerce.number().int().min(0).max(1e9),
  comments: z.coerce.number().int().min(0).max(1e9),
  saves: z.coerce.number().int().min(0).max(1e9),
  shares: z.coerce.number().int().min(0).max(1e9),
  profileVisits: z.coerce.number().int().min(0).max(1e9).optional(),
  follows: z.coerce.number().int().min(0).max(1e9).optional(),
});

export async function submitInsight(token: string, id: string, fd: FormData) {
  const { a, campaign } = await load(token, id);
  if (a.status !== "accepted" || !a.confirmedSlotId) back(token, id, "!撮影日の確定後に入力できます");
  if (campaign.reportSentAt && a.insight) back(token, id, "!レポート送付後のため変更できません。担当者にご連絡ください");
  const raw: Record<string, string | undefined> = {};
  for (const k of Object.keys(insightSchema.shape)) {
    const v = String(fd.get(k) ?? "").replace(/[,，\s]/g, "");
    raw[k] = v === "" ? undefined : v;
  }
  raw.postUrl = String(fd.get("postUrl") ?? "").trim();
  const parsed = insightSchema.safeParse(raw);
  if (!parsed.success) back(token, id, "!未入力の項目があります。数字は半角でご入力ください（0の場合は0）");
  const { postUrl, ...insight } = parsed.data;
  await recordInsight(a, postUrl, insight);
  redirect(`/m/${token}?flash=${encodeURIComponent("インサイトを提出しました。ありがとうございました！")}`);
}
