import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { LOCAL_UPLOAD_DIR } from "@/server/services/uploads";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** ローカル開発用の画像配信（Supabase Storage 未設定時のみ使われる） */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(rel)) return new NextResponse(null, { status: 404 });
  const file = path.join(LOCAL_UPLOAD_DIR, rel);
  if (!file.startsWith(LOCAL_UPLOAD_DIR + path.sep)) return new NextResponse(null, { status: 404 });
  try {
    const data = await readFile(file);
    return new NextResponse(new Uint8Array(data), {
      headers: { "content-type": TYPES[rel.split(".").pop()!], "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
