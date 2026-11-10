import type { Creator } from "./types";

/** SNSのプロフィールURL（登録したURL → SNSとアカウントから自動） */
export function creatorProfileUrl(c: Pick<Creator, "profileUrl" | "account" | "platform">): string | undefined {
  if (c.profileUrl) return c.profileUrl;
  const account = c.account?.replace(/^@/, "").trim();
  if (!account) return undefined;
  const p = c.platform.toLowerCase();
  if (p.includes("tiktok")) return `https://www.tiktok.com/@${account}`;
  if (p.includes("instagram") || p.includes("インスタ")) return `https://www.instagram.com/${account}/`;
  if (p.includes("youtube")) return `https://www.youtube.com/@${account}`;
  if (p === "x" || p.includes("twitter")) return `https://x.com/${account}`;
  return undefined;
}

/** アイコン画像のURL（未登録なら undefined） */
export function creatorIconUrl(c: Pick<Creator, "id" | "iconAt">): string | undefined {
  return c.iconAt ? `/api/ops/icon/${c.id}?v=${encodeURIComponent(c.iconAt)}` : undefined;
}

export const iconKey = (creatorId: string) => `icon:${creatorId}`;
