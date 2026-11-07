import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { del, issueSignedToken, presignUrl } from "@vercel/blob";
import { dbMode } from "./db";
import { isDemo } from "./demo-flag";
import type { VideoVersion } from "./types";

/**
 * 動画の保存先。
 *  - blob  : Vercel Blob（Vercel の Storage から Blob を追加して接続すると自動で設定される）
 *            新しい接続方式（OIDC）では BLOB_STORE_ID、以前の方式では BLOB_READ_WRITE_TOKEN が入ります
 *  - local : 開発用（.data/videos）
 *  - demo  : デモ（ファイルは保存しない）
 */
export type VideoStorage = "blob" | "local" | "demo";

/** Vercel Blob の認証方式 */
export function blobAuth(): "token" | "oidc" | null {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "token";
  if (process.env.BLOB_STORE_ID) return "oidc";
  return null;
}

/** 動画を公開URLで置くか（既定）、非公開で置いて表示のたびに期限付きURLを作るか（VIDEO_BLOB_ACCESS=private） */
export function blobAccess(): "public" | "private" {
  return process.env.VIDEO_BLOB_ACCESS === "private" ? "private" : "public";
}

export function videoStorage(): VideoStorage | null {
  if (isDemo()) return "demo";
  if (blobAuth()) return "blob";
  if (dbMode() === "file") return "local";
  return null;
}

/** 1本の上限（スマホで撮った1〜3分のリールなら十分な大きさ） */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export const localVideoDir = () => path.join(process.cwd(), ".data", "videos");

/** 再生用のURL（非公開の置き場なら、6時間有効の署名付きURLを作る） */
export async function playableUrl(v: VideoVersion): Promise<string> {
  if (v.storage !== "blob" || blobAccess() !== "private") return v.url;
  try {
    const pathname = new URL(v.url).pathname.replace(/^\//, "");
    const validUntil = Date.now() + 6 * 60 * 60 * 1000;
    const token = await issueSignedToken({ pathname, operations: ["get"], validUntil });
    return (await presignUrl(token, { operation: "get", pathname, validUntil, access: "private" })).presignedUrl;
  } catch (err) {
    console.error("[video] presign failed", err);
    return v.url;
  }
}

export async function deleteVideoFile(v: VideoVersion): Promise<void> {
  if (v.fileDeletedAt) return;
  try {
    if (v.storage === "blob") await del(v.storageKey);
    else if (v.storage === "local") await fs.rm(path.join(localVideoDir(), path.basename(v.storageKey)), { force: true });
  } catch (err) {
    console.error("[video] delete failed", err);
  }
}
