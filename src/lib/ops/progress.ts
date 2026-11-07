import { fmtDate, fmtSlot } from "./dates";
import { isComplete, missingLabels } from "./insight-fields";
import type { Assignment, Campaign } from "./types";

/**
 * 依頼1件の進捗。発信者の入力を増やさないよう、すでにある情報（回答・撮影日・投稿日・スクショ・レポート送付）から自動で判定します。
 *   回答 → 撮影 → 投稿 → インサイト → 完了
 * 「投稿」は投稿日を過ぎたか、スクショが届いた時点で済みとみなします（発信者が「投稿しました」と押す必要はありません）。
 */

export type StepState = "done" | "current" | "todo";
export type Step = { key: "reply" | "shoot" | "post" | "insight" | "done"; label: string; state: StepState };

export type Progress = {
  steps: Step[];
  /** 見送りなど、ステップ表示をしない状態 */
  closed?: "declined";
  /** 今の状況（一言） */
  status: string;
  tone: "gray" | "blue" | "green" | "amber" | "red";
  /** 次に誰が何をするか */
  next?: { who: "creator" | "admin" | "none"; text: string };
  /** 発信者の対応が必要か */
  actionNeeded: boolean;
};

const LABELS: Record<Step["key"], string> = { reply: "回答", shoot: "撮影", post: "投稿", insight: "インサイト", done: "完了" };

function build(currentIndex: number): Step[] {
  return (Object.keys(LABELS) as Step["key"][]).map((key, i) => ({
    key,
    label: LABELS[key],
    state: i < currentIndex ? "done" : i === currentIndex ? "current" : "todo",
  }));
}

export function progressOf(a: Assignment, c: Campaign, today: string): Progress {
  if (a.status === "declined") {
    return { steps: [], closed: "declined", status: "見送り", tone: "gray", actionNeeded: false };
  }
  if (a.status === "unsent" || a.status === "sent") {
    const late = c.replyDeadline < today;
    return {
      steps: build(0),
      status: a.status === "unsent" ? "依頼の準備中" : late ? "回答期限を過ぎています" : "回答待ち",
      tone: late ? "red" : "amber",
      next: a.status === "unsent" ? { who: "admin", text: "依頼を送る" } : { who: "creator", text: `参加できるか回答（期限 ${fmtDate(c.replyDeadline)}）` },
      actionNeeded: a.status === "sent",
    };
  }
  // 参加
  const slot = c.slots.find((s) => s.id === a.confirmedSlotId);
  if (!slot || !a.confirmedNotifiedAt) {
    return { steps: build(1), status: "撮影日の調整中", tone: "blue", next: { who: "admin", text: "撮影日を確定して連絡" }, actionNeeded: false };
  }
  if (slot.date > today) {
    return { steps: build(1), status: `撮影 ${fmtSlot(slot)}`, tone: "blue", next: { who: "creator", text: `${fmtSlot(slot)}に撮影` }, actionNeeded: false };
  }
  const postDate = a.plannedPostDate;
  const posted = Boolean(a.insight) || Boolean(postDate && postDate <= today);
  if (!posted) {
    return {
      steps: build(2),
      status: postDate ? `投稿日 ${fmtDate(postDate)}` : "投稿待ち",
      tone: "blue",
      next: { who: "creator", text: postDate ? `${fmtDate(postDate)}に投稿` : "投稿" },
      actionNeeded: false,
    };
  }
  if (!isComplete(a.insight)) {
    const lacking = a.insight ? missingLabels(a.insight) : [];
    return {
      steps: build(3),
      status: a.insight ? `スクショ不足（${lacking.join("・")}）` : a.insightRequestedAt ? "スクショ提出待ち" : "投稿済み",
      tone: a.insight || a.insightRequestedAt ? "red" : "blue",
      next: a.insight
        ? { who: "creator", text: `足りない項目（${lacking.join("・")}）のスクショを追加` }
        : a.insightRequestedAt
          ? { who: "creator", text: "インサイトのスクショを送る" }
          : { who: "none", text: "月末にスクショ提出のお願いが届きます" },
      actionNeeded: Boolean(a.insight || a.insightRequestedAt),
    };
  }
  if (!c.reportSentAt) {
    return { steps: build(4), status: "インサイト提出済み", tone: "green", next: { who: "admin", text: "レポートを飲食店へ送付" }, actionNeeded: false };
  }
  return { steps: build(5), status: "完了", tone: "green", actionNeeded: false };
}

/** 依頼した月（日本時間の YYYY-MM） */
export function monthOf(a: Assignment): string {
  const iso = a.sentAt ?? a.createdAt;
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit" }).format(new Date(iso)).slice(0, 7);
}

export const fmtMonth = (ym: string) => `${Number(ym.slice(0, 4))}年${Number(ym.slice(5, 7))}月`;

export function shiftMonth(ym: string, delta: number): string {
  const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
