import { fmtDate, fmtSlot } from "./dates";
import { isComplete, missingLabels } from "./insight-fields";
import type { Assignment, Campaign } from "./types";
import { latestVideo, revisionComment, videoEnabled, videoStage } from "./video-state";

/**
 * 依頼1件の進捗。発信者の入力を増やさないよう、すでにある情報（回答・撮影日・投稿日・スクショ・レポート送付）から自動で判定します。
 *   回答 → 撮影 → 投稿 → インサイト → 完了
 * 「投稿」は投稿日を過ぎたか、スクショが届いた時点で済みとみなします（発信者が「投稿しました」と押す必要はありません）。
 */

export type StepState = "done" | "current" | "todo";
export type Step = { key: "reply" | "shoot" | "video" | "post" | "insight" | "done"; label: string; state: StepState };

export type Progress = {
  steps: Step[];
  /** 見送りなど、ステップ表示をしない状態 */
  closed?: "declined";
  /** 今の状況（一言） */
  status: string;
  tone: "gray" | "blue" | "green" | "amber" | "red";
  /** 次に誰が何をするか */
  next?: { who: "creator" | "admin" | "shop" | "none"; text: string };
  /** 発信者の対応が必要か */
  actionNeeded: boolean;
};

const LABELS: Record<Step["key"], string> = { reply: "回答", shoot: "撮影", video: "動画", post: "投稿", insight: "インサイト", done: "完了" };

/** current＝いま進めているステップ（"end" なら全部済み） */
function stepsFor(withVideo: boolean, current: Step["key"] | "end"): Step[] {
  const keys = (Object.keys(LABELS) as Step["key"][]).filter((k) => withVideo || k !== "video");
  const idx = current === "end" ? keys.length : keys.indexOf(current);
  return keys.map((key, i) => ({ key, label: LABELS[key], state: i < idx ? "done" : i === idx ? "current" : "todo" }));
}

export function progressOf(a: Assignment, c: Campaign, today: string): Progress {
  const withVideo = videoEnabled(c);
  const build = (current: Step["key"] | "end") => stepsFor(withVideo, current);
  if (a.status === "declined") {
    return { steps: [], closed: "declined", status: "見送り", tone: "gray", actionNeeded: false };
  }
  if (a.status === "sent" && a.rescheduleRequestedAt) {
    return {
      steps: build("shoot"),
      status: "日程の選び直し待ち",
      tone: "amber",
      next: { who: "creator", text: "撮影日時を選び直す" },
      actionNeeded: true,
    };
  }
  if (a.status === "unsent" || a.status === "sent") {
    const late = c.replyDeadline < today;
    return {
      steps: build("reply"),
      status: a.status === "unsent" ? "依頼の準備中" : late ? "回答期限を過ぎています" : "回答待ち",
      tone: late ? "red" : "amber",
      next: a.status === "unsent" ? { who: "admin", text: "依頼を送る" } : { who: "creator", text: `参加できるか回答（期限 ${fmtDate(c.replyDeadline)}）` },
      actionNeeded: a.status === "sent",
    };
  }
  // 参加
  const slot = c.slots.find((s) => s.id === a.confirmedSlotId);
  if (!slot || !a.confirmedNotifiedAt) {
    return { steps: build("shoot"), status: "撮影日の調整中", tone: "blue", next: { who: "admin", text: "撮影日を確定して連絡" }, actionNeeded: false };
  }
  if (slot.date > today) {
    return { steps: build("shoot"), status: `撮影 ${fmtSlot(slot)}`, tone: "blue", next: { who: "creator", text: `${fmtSlot(slot)}に撮影` }, actionNeeded: false };
  }
  const postDate = a.plannedPostDate;
  const posted = Boolean(a.insight || a.postUrl) || Boolean(postDate && postDate <= today);
  // 投稿前の動画チェック（投稿が確認できたものは飛ばす）
  const vs = videoStage(a, c);
  if (withVideo && vs !== "approved" && !(a.insight || a.postUrl)) {
    const comment = revisionComment(latestVideo(a));
    const map = {
      waiting: { status: "動画の提出待ち", tone: "amber", next: { who: "creator", text: "撮影した動画を送る" }, action: true },
      owner_review: { status: "あなたの動画チェック待ち", tone: "amber", next: { who: "admin", text: "動画を確認する" }, action: false },
      shop_review: { status: "お店の動画確認待ち", tone: "blue", next: { who: "shop", text: "お店が動画を確認" }, action: false },
      revise: { status: "動画の修正待ち", tone: "red", next: { who: "creator", text: `動画を修正して送る${comment ? `（${comment.slice(0, 40)}）` : ""}` }, action: true },
    } as const;
    const m = map[vs as keyof typeof map];
    if (m) return { steps: build("video"), status: m.status, tone: m.tone, next: { ...m.next }, actionNeeded: m.action };
  }
  if (!posted) {
    return {
      steps: build("post"),
      status: postDate ? `投稿日 ${fmtDate(postDate)}` : "投稿待ち",
      tone: "blue",
      next: { who: "creator", text: postDate ? `${fmtDate(postDate)}に投稿` : "投稿" },
      actionNeeded: false,
    };
  }
  if (!isComplete(a.insight)) {
    const lacking = a.insight ? missingLabels(a.insight) : [];
    return {
      steps: build("insight"),
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
    return { steps: build("done"), status: "インサイト提出済み", tone: "green", next: { who: "admin", text: "レポートを飲食店へ送付" }, actionNeeded: false };
  }
  return { steps: build("end"), status: "完了", tone: "green", actionNeeded: false };
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
