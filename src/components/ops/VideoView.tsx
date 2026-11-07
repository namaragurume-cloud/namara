import { fmtDateTime } from "@/lib/ops/dates";
import type { VideoVersion } from "@/lib/ops/types";
import { fmtSize } from "@/lib/ops/video-state";
import { playableUrl } from "@/lib/ops/video-store";
import { Badge } from "./ui";

/** 動画1本の表示（再生・確認の結果） */
export async function VideoView({ v, index, showDecisions = true }: { v: VideoVersion; index?: number; showDecisions?: boolean }) {
  const src = v.fileDeletedAt || v.storage === "demo" ? "" : await playableUrl(v);
  return (
    <div className="space-y-2">
      {v.fileDeletedAt ? (
        <p className="rounded-xl bg-mist px-3 py-6 text-center text-xs text-muted">投稿後のため動画ファイルは削除しました（{fmtDateTime(v.fileDeletedAt)}）</p>
      ) : v.storage === "demo" ? (
        <p className="flex aspect-[9/16] max-h-80 items-center justify-center rounded-xl bg-zinc-800 px-3 text-center text-xs text-zinc-300">（デモ：動画はここで再生されます）</p>
      ) : (
        <video src={src} controls playsInline preload="metadata" className="max-h-[70svh] w-full rounded-xl bg-black" />
      )}
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {index !== undefined && <b className="text-ink">{index + 1}回目の提出</b>}
        {fmtDateTime(v.uploadedAt)}・{fmtSize(v.size)}
      </p>
      {showDecisions && (
        <div className="space-y-1 text-xs">
          {v.owner && (
            <p className="flex flex-wrap items-center gap-2">
              <Badge tone={v.owner.status === "ok" ? "green" : "red"}>担当 {v.owner.status === "ok" ? "OK" : "修正"}</Badge>
              {v.owner.comment && <span>「{v.owner.comment}」</span>}
            </p>
          )}
          {v.shop && (
            <p className="flex flex-wrap items-center gap-2">
              <Badge tone={v.shop.status === "ok" ? "green" : "red"}>お店 {v.shop.status === "ok" ? "OK" : "修正"}</Badge>
              {v.shop.comment && <span>「{v.shop.comment}」</span>}
              {v.shop.name && <span className="text-muted">確認：{v.shop.name}</span>}
              {v.shop.by === "admin" && <span className="text-muted">（担当が代理入力）</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
