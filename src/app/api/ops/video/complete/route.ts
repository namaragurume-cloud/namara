import { head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/spam";
import { addVideo } from "@/lib/ops/video";
import { canUploadVideo } from "@/lib/ops/video-access";

/** Vercel Blob へのアップロードが終わったら、その動画を登録する */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, message: "不正なリクエストです" }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { assignmentId?: string; token?: string; url?: string };
  const r = await canUploadVideo(b.assignmentId ?? "", b.token || null);
  if ("error" in r) return NextResponse.json({ ok: false, message: r.error }, { status: 403 });
  try {
    const url = new URL(b.url ?? "");
    if (!url.hostname.endsWith(".blob.vercel-storage.com")) throw new Error("bad host");
    const meta = await head(url.toString());
    if (!meta.pathname.startsWith(`videos/${r.access.a.id}/`)) throw new Error("bad path");
    const res = await addVideo(r.access.a.id, {
      url: meta.url,
      storageKey: meta.url,
      storage: "blob",
      size: meta.size,
      contentType: meta.contentType,
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    console.error("[video] complete failed", err);
    return NextResponse.json({ ok: false, message: "動画を登録できませんでした。もう一度お試しください" }, { status: 400 });
  }
}
