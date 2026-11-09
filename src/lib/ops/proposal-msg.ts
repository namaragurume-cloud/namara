import "server-only";
import { addDays, fmtDateLong } from "./dates";
import { proposalSettings } from "./proposal-store";
import { msg } from "./templates";
import type { Proposal, Restaurant } from "./types";
import { absoluteUrl } from "@/lib/utils";

export const proposalUrl = (p: Pick<Proposal, "shareToken">) => absoluteUrl(`/proposal/${p.shareToken}`);

/** 提案の有効期限（作成日＋設定の日数） */
export async function proposalValidUntil(p: Pick<Proposal, "createdAt">): Promise<string> {
  const s = await proposalSettings();
  const created = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date(p.createdAt));
  return addDays(created, s.validDays);
}

export async function proposalShareMsg(p: Proposal, r: Restaurant) {
  return msg("proposalShare", {
    店舗名: r.name,
    宛名: r.contactName ? `${r.contactName}様` : "ご担当者様",
    タイトル: p.text?.title ?? `${r.name}様 SNSプロモーションのご提案`,
    URL: proposalUrl(p),
    有効期限: fmtDateLong(await proposalValidUntil(p)),
  });
}
