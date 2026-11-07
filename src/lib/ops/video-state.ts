import type { Assignment, Campaign, VideoVersion } from "./types";

/**
 * 投稿前の動画チェックの状態（サーバー・クライアント共通）。
 *   提出待ち → （あなたの確認）→ 飲食店の確認 → OK
 *   どこかで「修正」になったら、発信者が出し直す
 */
export type VideoStage = "off" | "waiting" | "owner_review" | "shop_review" | "revise" | "approved";

export function videoEnabled(c: Pick<Campaign, "videoCheck">): boolean {
  return c.videoCheck === "direct" || c.videoCheck === "owner_first";
}

export const latestVideo = (a: Pick<Assignment, "videos">): VideoVersion | undefined => a.videos?.at(-1);

export function videoStage(a: Pick<Assignment, "videos">, c: Pick<Campaign, "videoCheck">): VideoStage {
  if (!videoEnabled(c)) return "off";
  const v = latestVideo(a);
  if (!v) return "waiting";
  if (c.videoCheck === "owner_first" && !v.owner) return "owner_review";
  if (v.owner?.status === "ng") return "revise";
  if (!v.shop) return "shop_review";
  return v.shop.status === "ok" ? "approved" : "revise";
}

export const videoStageLabel: Record<VideoStage, string> = {
  off: "",
  waiting: "動画の提出待ち",
  owner_review: "あなたの確認待ち",
  shop_review: "お店の確認待ち",
  revise: "動画の修正待ち",
  approved: "動画OK",
};

/** 修正のときの理由（お店かあなたのコメント） */
export function revisionComment(v?: VideoVersion): string | undefined {
  if (!v) return undefined;
  if (v.owner?.status === "ng") return v.owner.comment;
  if (v.shop?.status === "ng") return v.shop.comment;
  return undefined;
}

export const fmtSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.ceil(bytes / 1024)}KB`);
