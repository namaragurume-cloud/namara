import { shopVideoDecision } from "@/app/(ops)/p/actions";
import { SubmitButton } from "./client";
import { VideoView } from "./VideoView";
import { inputClass } from "./ui";
import { fmtDate } from "@/lib/ops/dates";
import type { Assignment, Campaign, Creator } from "@/lib/ops/types";
import { latestVideo, videoStage } from "@/lib/ops/video-state";

/** 飲食店向け：投稿前の動画の確認 */
export function ShopVideos({ token, campaign: c, rows }: { token: string; campaign: Campaign; rows: { a: Assignment; creator: Creator }[] }) {
  const items = rows
    .filter((r) => r.a.status === "accepted" && r.a.confirmedSlotId)
    .map((r) => ({ ...r, stage: videoStage(r.a, c), v: latestVideo(r.a) }))
    // 「先に担当が確認」の案件では、担当がOKした動画だけをお店に見せる
    .filter((r) => r.v && (r.stage === "shop_review" || r.v.shop));
  if (items.length === 0) return null;
  const pending = items.filter((r) => r.stage === "shop_review");
  const done = items.filter((r) => r.stage !== "shop_review");

  return (
    <section id="video" className="scroll-mt-4 space-y-4 print:hidden">
      <h2 className="text-lg font-extrabold">投稿前の動画のご確認</h2>
      {pending.length === 0 ? (
        <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">確認待ちの動画はありません。ありがとうございました。</p>
      ) : (
        <p className="text-sm">
          確認をお待ちしている動画が <b>{pending.length}件</b> あります。動画をご覧いただき、「OK」か「修正をお願いしたい」を押してください。
        </p>
      )}
      {pending.map((r) => (
        <div key={r.a.id} className="space-y-3 rounded-2xl border-2 border-brand/40 bg-white p-4">
          <p className="text-sm">
            <b>{r.creator.name}</b>さん
            {r.creator.account && <span className="ml-1 text-xs text-muted">@{r.creator.account}</span>}
            {r.a.plannedPostDate && <span className="ml-2 text-xs text-muted">投稿予定 {fmtDate(r.a.plannedPostDate)}</span>}
          </p>
          <VideoView v={r.v!} showDecisions={false} />
          <form action={shopVideoDecision.bind(null, token, r.a.id, r.v!.id)} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block font-bold">確認した方のお名前（任意）</span>
              <input name="name" placeholder="例：店長 山田" className={inputClass} />
            </label>
            <SubmitButton className="w-full" name="decision" value="ok">
              この動画でOK
            </SubmitButton>
            <div className="space-y-2 rounded-xl bg-mist p-3">
              <label className="block text-sm font-bold" htmlFor={`c-${r.a.id}`}>
                修正をお願いしたい場合
              </label>
              <textarea id={`c-${r.a.id}`} name="comment" rows={3} placeholder="例：冒頭にお店の外観を入れてください／メニュー名は「〇〇」です" className={inputClass} />
              <SubmitButton variant="outline" className="w-full" name="decision" value="ng">
                修正をお願いする
              </SubmitButton>
            </div>
          </form>
        </div>
      ))}
      {done.length > 0 && (
        <details className="rounded-2xl border border-line bg-white p-4">
          <summary className="cursor-pointer text-sm font-bold">確認済みの動画（{done.length}件）</summary>
          <ul className="mt-3 space-y-4">
            {done.map((r) => (
              <li key={r.a.id} className="space-y-2">
                <p className="text-sm">
                  <b>{r.creator.name}</b>さん
                </p>
                <VideoView v={r.v!} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
