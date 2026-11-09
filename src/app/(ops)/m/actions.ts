"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/ops/db";
import { jstDate } from "@/lib/ops/dates";
import { findCreatorByToken, recordResponse } from "@/lib/ops/service";
import { flexSlotId, isFlex, isValidFlexPick } from "@/lib/ops/slots";

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
  let slotIds = fd.getAll("slot").map(String);
  if (isFlex(campaign)) {
    // 第1〜第3希望（日付＋開始時刻）を希望の順番で
    const today = jstDate();
    const picks: string[] = [];
    for (const n of [0, 1, 2]) {
      const d = String(fd.get(`pref${n}Date`) ?? "");
      const t = String(fd.get(`pref${n}Time`) ?? "");
      if (!d && !t) continue;
      if (!d || !t) back(token, id, `!第${n + 1}希望の日付と時刻を両方選んでください`);
      if (d < today || !isValidFlexPick(campaign.flex!, d, t)) back(token, id, `!第${n + 1}希望の日時は選べません。もう一度選んでください`);
      const sid = flexSlotId(d, t);
      if (!picks.includes(sid)) picks.push(sid);
    }
    slotIds = picks;
  }
  const plannedPostDate = String(fd.get("plannedPostDate") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 500) || undefined;
  const party = Number(fd.get("partySize"));
  const partySize = party === 1 || party === 2 ? party : undefined;
  if (fd.get("answer") !== "yes" && fd.get("answer") !== "no") back(token, id, "!参加するかどうかを選んでください");
  if (accept && !a.confirmedNotifiedAt && slotIds.length === 0) back(token, id, isFlex(campaign) ? "!第1希望の日時を選んでください" : "!参加できる日時を1つ以上選んでください");
  if (plannedPostDate && !ymd.test(plannedPostDate)) back(token, id, "!投稿日の形式が正しくありません");
  const postDates = campaign.postDates ?? [];
  if (accept && postDates.length) {
    if (!plannedPostDate && !a.confirmedNotifiedAt) back(token, id, "!投稿日をカレンダーから選んでください");
    if (plannedPostDate && !postDates.includes(plannedPostDate) && plannedPostDate !== a.plannedPostDate) back(token, id, "!投稿日は色のついた日から選んでください");
  }
  await recordResponse(a, campaign, { accept, slotIds, plannedPostDate: plannedPostDate || undefined, partySize, note });
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
