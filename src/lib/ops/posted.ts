import type { Assignment } from "./types";

/**
 * 投稿済みか：投稿URLが届いた・インサイトが届いた・あなたが確認した（postedAt）のどれか。
 * 管理画面・お店のページ・リマインドで同じ判定を使う。
 */
export const isPosted = (a: Pick<Assignment, "postUrl" | "insight" | "postedAt">): boolean => Boolean(a.postUrl || a.insight || a.postedAt);
