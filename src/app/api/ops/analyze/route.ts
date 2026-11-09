import { NextResponse } from "next/server";
import { accessAssignment } from "@/lib/ops/access";
import { analyzeAssignment } from "@/lib/ops/insights";
import { isSameOrigin, isRateLimited } from "@/lib/spam";

/** 送られたスクショをAIで読み取る */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, message: "不正なリクエストです" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { assignmentId?: string; token?: string };
  const access = await accessAssignment(body.assignmentId ?? "", body.token || null);
  if (!access) return NextResponse.json({ ok: false, message: "このページからは送れません" }, { status: 403 });
  if (access.as === "creator" && isRateLimited(`analyze:${access.a.id}`)) {
    return NextResponse.json({ ok: false, message: "短時間に何度も読み取りが行われました。10分ほど待ってからお試しください" }, { status: 429 });
  }
  const r = await analyzeAssignment(access.a.id, { notify: false });
  switch (r.status) {
    case "ok":
      return NextResponse.json({ ok: true, missing: r.missing });
    case "no-ai":
      return NextResponse.json({ ok: true, pending: true });
    case "no-shots":
      return NextResponse.json({ ok: false, message: "画像がありません" }, { status: 400 });
    case "stale":
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ ok: false, message: r.message }, { status: 502 });
  }
}
