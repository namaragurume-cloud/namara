import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { canUploadVideo } from "@/lib/ops/video-access";
import { MAX_VIDEO_BYTES } from "@/lib/ops/video-store";

/** Vercel Blob へ直接アップロードするための一時的な許可を発行 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const p = JSON.parse(clientPayload ?? "{}") as { assignmentId?: string; token?: string };
        const r = await canUploadVideo(p.assignmentId ?? "", p.token || null);
        if ("error" in r) throw new Error(r.error);
        if (!pathname.startsWith(`videos/${r.access.a.id}/`)) throw new Error("保存先が正しくありません");
        return { allowedContentTypes: ["video/*"], maximumSizeInBytes: MAX_VIDEO_BYTES, addRandomSuffix: true };
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "アップロードできませんでした" }, { status: 400 });
  }
}
