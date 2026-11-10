import { blobs } from "@/lib/ops/db";
import { iconKey } from "@/lib/ops/creator-profile";

/** 発信者のアイコン画像（料金表などに表示。SNSで公開しているアイコンを想定） */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await blobs.get(iconKey(id)).catch(() => null);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(data, "base64")), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable", "X-Robots-Tag": "noindex" },
  });
}
