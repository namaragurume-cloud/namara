import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/spam";
import { shortId } from "@/lib/ops/util";
import { addVideo } from "@/lib/ops/video";
import { canUploadVideo } from "@/lib/ops/video-access";
import { localVideoDir, MAX_VIDEO_BYTES, videoStorage } from "@/lib/ops/video-store";

/**
 * 開発用・デモ用のアップロード先。
 *  - local：このパソコンの .data/videos に保存
 *  - demo ：ファイルは保存せず、記録だけ残す（大きな動画を送らないよう、ブラウザからは名前と大きさだけ届く）
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ ok: false, message: "不正なリクエストです" }, { status: 403 });
  const mode = videoStorage();
  if (mode !== "local" && mode !== "demo") return NextResponse.json({ ok: false, message: "使えません" }, { status: 404 });
  const fd = await req.formData();
  const r = await canUploadVideo(String(fd.get("assignmentId") ?? ""), (fd.get("token") as string | null) || null);
  if ("error" in r) return NextResponse.json({ ok: false, message: r.error }, { status: 403 });

  if (mode === "demo") {
    const size = Number(fd.get("size") ?? 0);
    const res = await addVideo(r.access.a.id, { url: "", storageKey: "demo", storage: "demo", size, contentType: String(fd.get("type") ?? "video/mp4") });
    return NextResponse.json({ ok: true, ...res });
  }
  const file = fd.get("file");
  if (!(file instanceof File) || !file.type.startsWith("video/")) return NextResponse.json({ ok: false, message: "動画を選んでください" }, { status: 400 });
  if (file.size > MAX_VIDEO_BYTES) return NextResponse.json({ ok: false, message: "動画が大きすぎます" }, { status: 400 });
  const ext = (file.name.split(".").pop() ?? "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "mp4";
  const name = `${r.access.a.id}-${Date.now().toString(36)}${shortId()}.${ext}`;
  await fs.mkdir(localVideoDir(), { recursive: true });
  await fs.writeFile(path.join(localVideoDir(), name), Buffer.from(await file.arrayBuffer()));
  const res = await addVideo(r.access.a.id, { url: `/api/ops/video/file/${name}`, storageKey: name, storage: "local", size: file.size, contentType: file.type });
  return NextResponse.json({ ok: true, ...res });
}
