import "server-only";
import type { Msg } from "@/data/ops-templates";
import { db } from "./db";
import { isDemo } from "./demo-flag";
import { isEmailConfigured, sendEmail } from "./email";
import { isLineConfigured, linePush } from "./line";
import type { Channel, Creator, MessageLog, Restaurant } from "./types";
import { nowIso, shortId } from "./util";

export type SendResult = { ok: boolean; channel: Channel; error?: string };

async function log(entry: Omit<MessageLog, "id" | "createdAt">) {
  await db.put("messages", { ...entry, id: `${Date.now().toString(36)}-${shortId()}`, createdAt: nowIso() });
}

/**
 * 発信者へ送信。公式LINE（連携済みの場合）→ メール の順に試します。
 * どちらも使えない場合は「手動」として記録し、管理画面からコピーして送れるようにします。
 */
export async function sendToCreator(creator: Creator, msg: Msg, purpose: string): Promise<SendResult> {
  if (isDemo()) {
    // デモ：実際には送らず、送ったものとして履歴にだけ残す
    const channel: Channel = creator.lineUserId ? "line" : creator.email ? "email" : "manual";
    const ok = channel !== "manual";
    const error = ok ? undefined : "LINE未連携・メール未登録のため自動送信できません";
    await log({ toKind: "creator", toId: creator.id, toName: creator.name, channel, ok, purpose: `［デモ・実際には未送信］${purpose}`, text: msg.text, error });
    return { ok, channel, error };
  }
  const errors: string[] = [];
  if (creator.lineUserId && isLineConfigured()) {
    try {
      await linePush(creator.lineUserId, msg.text);
      await log({ toKind: "creator", toId: creator.id, toName: creator.name, channel: "line", ok: true, purpose, text: msg.text });
      return { ok: true, channel: "line" };
    } catch (e) {
      errors.push(String(e instanceof Error ? e.message : e));
    }
  }
  if (creator.email && isEmailConfigured()) {
    try {
      await sendEmail(creator.email, msg.subject, msg.text);
      await log({ toKind: "creator", toId: creator.id, toName: creator.name, channel: "email", ok: true, purpose, text: msg.text });
      return { ok: true, channel: "email" };
    } catch (e) {
      errors.push(String(e instanceof Error ? e.message : e));
    }
  }
  const error = errors.join(" / ") || "LINE未連携・メール未登録のため自動送信できません";
  await log({ toKind: "creator", toId: creator.id, toName: creator.name, channel: "manual", ok: false, purpose, text: msg.text, error });
  return { ok: false, channel: "manual", error };
}

/** 飲食店へメール送信（メールアドレス未登録なら手動扱い） */
/** 飲食店へ送信。公式LINE（連携済みの場合）→ メール の順。どちらもなければ手動扱い */
export async function sendToRestaurant(restaurant: Restaurant, msg: Msg, purpose: string): Promise<SendResult> {
  if (isDemo()) {
    const channel: Channel = restaurant.lineGroupId || restaurant.lineUserId ? "line" : restaurant.email ? "email" : "manual";
    const ok = channel !== "manual";
    const error = ok ? undefined : "LINE未連携・メール未登録のため自動送信できません";
    await log({ toKind: "restaurant", toId: restaurant.id, toName: restaurant.name, channel, ok, purpose: `［デモ・実際には未送信］${purpose}`, text: msg.text, error });
    return { ok, channel, error };
  }
  const errors: string[] = [];
  const lineTo = restaurant.lineGroupId || restaurant.lineUserId;
  if (lineTo && isLineConfigured()) {
    try {
      await linePush(lineTo, msg.text);
      await log({ toKind: "restaurant", toId: restaurant.id, toName: restaurant.name, channel: "line", ok: true, purpose, text: msg.text });
      return { ok: true, channel: "line" };
    } catch (e) {
      errors.push(String(e instanceof Error ? e.message : e));
    }
  }
  let error = errors.join(" / ") || "LINE未連携・メール未登録のため自動送信できません";
  if (restaurant.email && isEmailConfigured()) {
    try {
      await sendEmail(restaurant.email, msg.subject, msg.text);
      await log({ toKind: "restaurant", toId: restaurant.id, toName: restaurant.name, channel: "email", ok: true, purpose, text: msg.text });
      return { ok: true, channel: "email" };
    } catch (e) {
      error = [...errors, String(e instanceof Error ? e.message : e)].join(" / ");
    }
  }
  await log({ toKind: "restaurant", toId: restaurant.id, toName: restaurant.name, channel: "manual", ok: false, purpose, text: msg.text, error });
  return { ok: false, channel: "manual", error };
}
