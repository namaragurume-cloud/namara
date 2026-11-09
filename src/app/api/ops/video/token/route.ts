import { issueSignedToken } from "@vercel/blob";
import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { canUploadVideo } from "@/lib/ops/video-access";
import { blobAccess, blobAuth, MAX_VIDEO_BYTES } from "@/lib/ops/video-store";

/**
 * ブラウザから Vercel Blob へ直接アップロードするための一時的な許可を発行。
 *  - 以前の接続方式（BLOB_READ_WRITE_TOKEN）：handleUpload（クライアントトークン）
 *  - 新しい接続方式（OIDC・BLOB_STORE_ID）　：handleUploadPresigned（署名付きURL）
 */
export const dynamic = "force-dynamic";

async function check(pathname: string, clientPayload: string | null) {
  const p = JSON.parse(clientPayload ?? "{}") as { assignmentId?: string; token?: string };
  const r = await canUploadVideo(p.assignmentId ?? "", p.token || null);
  if ("error" in r) throw new Error(r.error);
  if (!pathname.startsWith(`videos/${r.access.a.id}/`)) throw new Error("保存先が正しくありません");
}

export async function POST(request: Request) {
  const body = await request.json();
  try {
    if (blobAuth() === "oidc") {
      const json = await handleUploadPresigned({
        body: body as HandleUploadPresignedBody,
        request,
        getSignedToken: async (pathname, clientPayload) => {
          await check(pathname, clientPayload);
          const limits = { allowedContentTypes: ["video/*"], maximumSizeInBytes: MAX_VIDEO_BYTES };
          const token = await issueSignedToken({ pathname, operations: ["put"], validUntil: Date.now() + 60 * 60 * 1000, ...limits });
          return { token, urlOptions: { ...limits, addRandomSuffix: true } };
        },
      });
      return NextResponse.json(json);
    }
    const json = await handleUpload({
      body: body as HandleUploadBody,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        await check(pathname, clientPayload);
        return { allowedContentTypes: ["video/*"], maximumSizeInBytes: MAX_VIDEO_BYTES, addRandomSuffix: true };
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    console.error("[video] token failed", err, blobAccess());
    return NextResponse.json({ error: err instanceof Error ? err.message : "アップロードできませんでした" }, { status: 400 });
  }
}
