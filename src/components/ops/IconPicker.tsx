"use client";

import { useRef, useState } from "react";
import { buttonClass } from "./ui";
import { CreatorAvatar } from "./CreatorAvatar";

const SIZE = 240;

/** アイコン画像を選ぶと、正方形に切り抜いて小さくしたものをフォームに入れる */
export function IconPicker({ name, current }: { name: string; current?: string }) {
  const [preview, setPreview] = useState<string | undefined>(current);
  const [data, setData] = useState("");
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function onFile(file?: File) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("画像ファイルを選んでください");
    try {
      const bmp = await createImageBitmap(file);
      const side = Math.min(bmp.width, bmp.height);
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      canvas.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
      const url = canvas.toDataURL("image/jpeg", 0.85);
      setData(url);
      setPreview(url);
      setRemoved(false);
    } catch {
      setError("この画像は読み込めませんでした。JPEGかPNGで試してください");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <CreatorAvatar name={name || "?"} src={removed ? undefined : preview} size={56} />
      <input type="hidden" name="icon" value={data} />
      <input type="hidden" name="removeIcon" value={removed ? "1" : ""} />
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <button type="button" className={buttonClass("outline", "sm")} onClick={() => input.current?.click()}>
        画像を選ぶ
      </button>
      {preview && !removed && (
        <button
          type="button"
          className="text-xs text-muted underline"
          onClick={() => {
            setRemoved(true);
            setData("");
          }}
        >
          アイコンを外す
        </button>
      )}
      {data && <span className="text-xs text-muted">「保存」を押すと反映されます</span>}
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
    </div>
  );
}
