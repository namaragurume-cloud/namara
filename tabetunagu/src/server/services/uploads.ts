import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/lib/errors";
import { env } from "../env";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".data/uploads");

function sniff(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

export function uploadsAvailable() {
  return Boolean(env.storage.supabaseUrl && env.storage.serviceRoleKey) || !process.env.VERCEL;
}

/**
 * 商品写真を保存して公開 URL を返す。
 * - Supabase Storage（サーバーから service role key でアップロード。キーはクライアントに渡さない）
 * - 未設定のローカル開発では .data/uploads に保存し /api/uploads/... で配信
 */
export async function saveProductImage(file: File, storeId: string): Promise<string> {
  if (file.size === 0 || file.size > MAX_BYTES) throw new AppError("invalid_image");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type || !TYPES[type]) throw new AppError("invalid_image");
  const objectPath = `${storeId}/${randomUUID()}.${TYPES[type]}`;

  if (env.storage.supabaseUrl && env.storage.serviceRoleKey) {
    const res = await fetch(`${env.storage.supabaseUrl}/storage/v1/object/${env.storage.bucket}/${objectPath}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.storage.serviceRoleKey}`,
        "content-type": type,
        "cache-control": "31536000",
        "x-upsert": "false",
      },
      body: bytes,
    });
    if (!res.ok) {
      console.error("[upload] Supabase Storage error", res.status, await res.text().catch(() => ""));
      throw new AppError("upload_unavailable");
    }
    return `${env.storage.supabaseUrl}/storage/v1/object/public/${env.storage.bucket}/${objectPath}`;
  }
  if (process.env.VERCEL) throw new AppError("upload_unavailable");
  const target = path.join(LOCAL_UPLOAD_DIR, objectPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return `/api/uploads/${objectPath}`;
}
