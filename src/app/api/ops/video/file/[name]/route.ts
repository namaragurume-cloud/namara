import { promises as fs } from "node:fs";
import path from "node:path";
import { localVideoDir, videoStorage } from "@/lib/ops/video-store";

/** 開発用：ローカルに保存した動画の配信（シーク用に Range に対応） */
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  if (videoStorage() !== "local") return new Response("Not found", { status: 404 });
  const name = path.basename((await ctx.params).name);
  const file = path.join(localVideoDir(), name);
  let data: Buffer;
  try {
    data = await fs.readFile(file);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const type = name.endsWith(".mov") ? "video/quicktime" : name.endsWith(".webm") ? "video/webm" : "video/mp4";
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: { "Content-Type": type, "Content-Range": `bytes ${start}-${end}/${data.length}`, "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(data), { headers: { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": String(data.length) } });
}
