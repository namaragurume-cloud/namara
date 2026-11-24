import { issueSignedToken } from "@vercel/blob";
import { NextResponse } from "next/server";
import { canUploadVideo } from "@/lib/ops/video-access";
import { blobAuth, MAX_VIDEO_BYTES } from "@/lib/ops/video-store";
import { fmtSize } from "@/lib/ops/video-state";

/**
 * 動画を送る前の確認。送れない理由をわかる言葉で返す
 * （アップロードの仕組みは、サーバーが断った理由を画面に出さないため）。
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const p = (await request.json().catch(() => ({}))) as { assignmentId?: string; token?: string; size?: number };
  const r = await canUploadVideo(p.assignmentId ?? "", p.token || null);
  if ("error" in r) return NextResponse.json({ ok: false, message: r.error });
  if (typeof p.size === "number" && p.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({
      ok: false,
      message: `動画が大きすぎます（${fmtSize(p.size)}・上限${fmtSize(MAX_VIDEO_BYTES)}）。画質を1080p・30fpsにして書き出し直してから送ってください。`,
    });
  }
  // 新しい接続方式（OIDC）：保存先が受け付けるか、実際に許可を作って確かめる
  if (blobAuth() === "oidc") {
    try {
      await issueSignedToken({ pathname: `videos/${r.access.a.id}/check`, operations: ["put"], validUntil: Date.now() + 60_000 });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[video] check: signed token failed", err);
      return NextResponse.json({
        ok: false,
        message: "動画の保存先（Vercel Blob）が今は受け付けていません。担当者に連絡してください。",
        detail,
      });
    }
  }
  return NextResponse.json({ ok: true });
}
