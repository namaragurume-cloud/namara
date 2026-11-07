import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { del } from "@vercel/blob";
import { dbMode } from "./db";
import { isDemo } from "./demo-flag";
import type { VideoVersion } from "./types";

/**
 * 動画の保存先。
 *  - blob  : Vercel Blob（BLOB_READ_WRITE_TOKEN。Vercel の Storage から Blob を追加すると自動で入る）
 *  - local : 開発用（.data/videos）
 *  - demo  : デモ（ファイルは保存しない）
 */
export type VideoStorage = "blob" | "local" | "demo";

export function videoStorage(): VideoStorage | null {
  if (isDemo()) return "demo";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (dbMode() === "file") return "local";
  return null;
}

/** 1本の上限（スマホで撮った1〜3分のリールなら十分な大きさ） */
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

export const localVideoDir = () => path.join(process.cwd(), ".data", "videos");

export async function deleteVideoFile(v: VideoVersion): Promise<void> {
  if (v.fileDeletedAt) return;
  try {
    if (v.storage === "blob") await del(v.storageKey);
    else if (v.storage === "local") await fs.rm(path.join(localVideoDir(), path.basename(v.storageKey)), { force: true });
  } catch (err) {
    console.error("[video] delete failed", err);
  }
}
