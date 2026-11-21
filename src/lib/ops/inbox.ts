import "server-only";
import { blobs, db } from "./db";
import type { InboxImage } from "./types";
import { nowIso, shortId } from "./util";

const key = (id: string) => `inbox:${id}`;

/** 公式LINEで受け取った画像を「受け取った画像」に置く（画像は180日で自動削除） */
export async function putInbox(input: { creatorId: string; mediaType: string; data: Buffer; what?: string; reason: InboxImage["reason"] }): Promise<InboxImage> {
  const item: InboxImage = {
    id: `${Date.now().toString(36)}${shortId()}`,
    creatorId: input.creatorId,
    mediaType: input.mediaType,
    bytes: input.data.length,
    what: input.what,
    reason: input.reason,
    createdAt: nowIso(),
  };
  await blobs.set(key(item.id), input.data.toString("base64"));
  await db.put("inbox", item);
  return item;
}

export async function inboxData(id: string): Promise<Buffer | null> {
  const b64 = await blobs.get(key(id));
  return b64 ? Buffer.from(b64, "base64") : null;
}

export async function deleteInbox(id: string): Promise<void> {
  await db.remove("inbox", id);
  await blobs.del(key(id)).catch(() => {});
}
