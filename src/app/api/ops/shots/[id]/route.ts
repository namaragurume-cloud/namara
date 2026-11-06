import { accessAssignment } from "@/lib/ops/access";
import { blobs, db } from "@/lib/ops/db";

/** スクショ画像の表示（管理者か本人のみ） */
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const shot = await db.get("shots", id);
  if (!shot) return new Response("Not found", { status: 404 });
  const access = await accessAssignment(shot.assignmentId, new URL(req.url).searchParams.get("token"));
  if (!access) return new Response("Forbidden", { status: 403 });
  const data = await blobs.get(shot.id);
  if (!data) return new Response("画像の保存期間が過ぎました", { status: 410 });
  return new Response(Buffer.from(data, "base64"), {
    headers: { "Content-Type": shot.mediaType, "Cache-Control": "private, max-age=3600", "X-Robots-Tag": "noindex" },
  });
}
