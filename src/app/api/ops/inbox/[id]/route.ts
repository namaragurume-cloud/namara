import { isAdmin } from "@/lib/ops/auth";
import { db } from "@/lib/ops/db";
import { inboxData } from "@/lib/ops/inbox";

/** 公式LINEで受け取った画像（管理者のみ） */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const item = await db.get("inbox", id);
  if (!item) return new Response("Not found", { status: 404 });
  const data = await inboxData(id);
  if (!data) return new Response("画像の保存期間が過ぎました", { status: 410 });
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": item.mediaType, "Cache-Control": "private, max-age=3600", "X-Robots-Tag": "noindex" },
  });
}
