"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buttonClass } from "./ui";

type ShotView = { id: string; url: string };

/** 画像を長辺2000pxまでのJPEGに縮小（文字は読める大きさのまま、送信を軽くする） */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.88));
    return blob ?? file;
  } catch {
    return file; // HEIC など縮小できない形式はそのまま
  }
}

export function ShotUploader({
  assignmentId,
  token,
  shots,
  canAnalyze,
  disabled,
  pasteAndDrop,
}: {
  assignmentId: string;
  token?: string;
  shots: ShotView[];
  /** AIでの読み取りが使えるか */
  canAnalyze: boolean;
  disabled?: boolean;
  /** 画像の貼り付け（Ctrl+V / ⌘V）とドラッグ＆ドロップでも追加できるようにする（管理画面用） */
  pasteAndDrop?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setBusy("数字を読み取っています…（30秒ほどかかります）");
    const res = await fetch("/api/ops/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, token }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (!body.ok) setError(body.message ?? "読み取りに失敗しました");
  }

  const [dragging, setDragging] = useState(false);
  const uploadRef = useRef<(files: File[]) => void>(() => {});

  // 貼り付け：DMの画像をコピーして、このページで Ctrl+V / ⌘V
  useEffect(() => {
    if (!pasteAndDrop || disabled) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (files.length) {
        e.preventDefault();
        uploadRef.current(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pasteAndDrop, disabled]);

  async function upload(files: FileList | File[]) {
    setError(null);
    const list = [...files].filter((f) => f.type.startsWith("image/") || !f.type);
    if (list.length === 0) return setError("画像ファイルを選んでください");
    try {
      for (let i = 0; i < list.length; i++) {
        setBusy(`画像を送信中… ${i + 1}/${list.length}`);
        const fd = new FormData();
        fd.set("assignmentId", assignmentId);
        if (token) fd.set("token", token);
        const blob = await shrink(list[i]);
        fd.set("file", new File([blob], `shot-${i}.jpg`, { type: blob.type || list[i].type }));
        const res = await fetch("/api/ops/shots", { method: "POST", body: fd });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
        if (!body.ok) throw new Error(body.message ?? "送信に失敗しました");
      }
      if (canAnalyze) await analyze();
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
      router.refresh();
    }
  }

  // 貼り付け・ドロップからは最新の upload を呼ぶ
  useEffect(() => {
    uploadRef.current = (files) => {
      if (!busy) void upload(files);
    };
  });

  async function remove(id: string) {
    if (!window.confirm("この画像を削除しますか？")) return;
    setBusy("削除中…");
    const qs = new URLSearchParams({ id, ...(token ? { token } : {}) });
    const res = await fetch(`/api/ops/shots?${qs}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (!body.ok) setError(body.message ?? "削除できませんでした");
    else if (canAnalyze && shots.length > 1) await analyze();
    setBusy(null);
    router.refresh();
  }

  const dropProps = pasteAndDrop && !disabled
    ? {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: () => setDragging(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) uploadRef.current([...e.dataTransfer.files]);
        },
      }
    : {};

  return (
    <div className={cn("space-y-3", pasteAndDrop && "rounded-xl border-2 border-dashed p-3", pasteAndDrop && (dragging ? "border-brand bg-brand/5" : "border-line"))} {...dropProps}>
      {shots.length > 0 && (
        <ul className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", pasteAndDrop && "md:grid-cols-6 lg:grid-cols-8")}>
          {shots.map((s) => (
            <li key={s.id} className="relative overflow-hidden rounded-xl border border-line bg-mist">
              <a href={s.url} target="_blank" rel="noopener">
                {/* eslint-disable-next-line @next/next/no-img-element -- 認証付きの画像のため next/image は使わない */}
                <img src={s.url} alt="送信したスクリーンショット" className="aspect-[9/16] w-full object-cover object-top" loading="lazy" />
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  disabled={Boolean(busy)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-bold text-white"
                  aria-label="この画像を削除"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            id={`shot-${assignmentId}`}
            onChange={(e) => e.target.files?.length && upload(e.target.files)}
          />
          <label htmlFor={`shot-${assignmentId}`} className={cn(buttonClass("primary"), "w-full cursor-pointer", busy && "pointer-events-none opacity-50")}>
            {busy ?? (shots.length ? "＋ スクショを追加する" : "スクショを選んで送る（複数枚OK）")}
          </label>
          {pasteAndDrop && <p className="text-center text-xs text-muted">ここに画像をドラッグ、またはDMの画像をコピーしてこのページで貼り付け（Ctrl+V / ⌘V）もできます</p>}
          {canAnalyze && shots.length > 0 && !busy && (
            <button type="button" className={cn(buttonClass("outline", "sm"), "w-full")} onClick={async () => { setError(null); await analyze(); setBusy(null); router.refresh(); }}>
              もう一度読み取る
            </button>
          )}
        </>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </div>
  );
}
