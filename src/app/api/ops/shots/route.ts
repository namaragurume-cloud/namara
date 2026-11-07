import { NextResponse } from "next/server";
import { accessAssignment } from "@/lib/ops/access";
import { db } from "@/lib/ops/db";
import { deleteShot, saveShot, ShotError } from "@/lib/ops/insights";
import { isSameOrigin } from "@/lib/spam";

/** インサイトのスクショを1枚アップロード（発信者ページ・管理画面から） */
export const dynamic = "force-dynamic";

const err = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return err("不正なリクエストです", 403);
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return err("画像を読み取れませんでした");
  }
  const access = await accessAssignment(String(fd.get("assignmentId") ?? ""), (fd.get("token") as string | null) || null);
  if (!access) return err("このページからは送れません", 403);
  if (access.as === "creator" && access.campaign.reportSentAt) return err("この案件は終了しています");
  const file = fd.get("file");
  if (!(file instanceof File)) return err("画像を選んでください");
  try {
    const shot = await saveShot(access.a, {
      via: access.as === "admin" ? "admin" : "web",
      mediaType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({ ok: true, id: shot.id });
  } catch (e) {
    if (e instanceof ShotError) return err(e.message);
    console.error("[shots] save failed", e);
    return err("保存に失敗しました。時間をおいてお試しください", 500);
  }
}

export async function DELETE(req: Request) {
  if (!isSameOrigin(req)) return err("不正なリクエストです", 403);
  const url = new URL(req.url);
  const shot = await db.get("shots", url.searchParams.get("id") ?? "");
  if (!shot) return err("画像が見つかりません", 404);
  const access = await accessAssignment(shot.assignmentId, url.searchParams.get("token"));
  if (!access) return err("削除できません", 403);
  if (access.as === "creator" && access.campaign.reportSentAt) return err("この案件は終了しています");
  await deleteShot(shot);
  return NextResponse.json({ ok: true });
}
