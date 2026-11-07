"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buttonClass } from "./ui";

/**
 * 動画のアップロード。
 *  - blob ：ブラウザから Vercel Blob へ直接（大きな動画でもOK・進み具合を表示）
 *  - local：開発用（サーバーに送って保存）
 *  - demo ：ファイルは送らず、名前と大きさだけ記録
 */
export function VideoUploader({
  assignmentId,
  token,
  mode,
  label = "動画を選んで送る",
}: {
  assignmentId: string;
  token?: string;
  mode: "blob" | "local" | "demo" | null;
  label?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!mode) return <p className="text-sm text-amber-700">動画の保存先が未設定です（管理画面の「設定」を確認してください）。</p>;

  async function send(file: File) {
    setError(null);
    try {
      if (!file.type.startsWith("video/")) throw new Error("動画ファイルを選んでください");
      let res: Response;
      if (mode === "blob") {
        const ext = (file.name.split(".").pop() ?? "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "mp4";
        const blob = await upload(`videos/${assignmentId}/${Date.now()}.${ext}`, file, {
          access: "public",
          handleUploadUrl: "/api/ops/video/token",
          clientPayload: JSON.stringify({ assignmentId, token }),
          multipart: file.size > 20 * 1024 * 1024,
          onUploadProgress: (p) => setBusy(`動画を送信中… ${Math.floor(p.percentage)}%`),
        });
        setBusy("登録しています…");
        res = await fetch("/api/ops/video/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignmentId, token, url: blob.url }),
        });
      } else {
        setBusy("動画を送信中…");
        const fd = new FormData();
        fd.set("assignmentId", assignmentId);
        if (token) fd.set("token", token);
        if (mode === "local") fd.set("file", file);
        else {
          fd.set("size", String(file.size));
          fd.set("type", file.type);
        }
        res = await fetch("/api/ops/video/local", { method: "POST", body: fd });
      }
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
      if (!body.ok) throw new Error(body.message ?? "送信に失敗しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      <input ref={input} id={`video-${assignmentId}`} type="file" accept="video/*" className="sr-only" onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
      <label htmlFor={`video-${assignmentId}`} className={cn(buttonClass("primary"), "w-full cursor-pointer", busy && "pointer-events-none opacity-60")}>
        {busy ?? label}
      </label>
      {busy && <p className="text-xs text-muted">送信が終わるまで、この画面を閉じないでください。</p>}
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
