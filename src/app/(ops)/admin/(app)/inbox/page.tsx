import Link from "next/link";
import { SubmitButton } from "@/components/ops/client";
import { Badge, Card, Empty, Flash, inputClass } from "@/components/ops/ui";
import { fmtDateTime } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { needsInsight } from "@/lib/ops/insights";
import { slotLabel } from "@/lib/ops/service";
import type { InboxImage } from "@/lib/ops/types";
import { inboxDeleteAction, inboxDoneAction, inboxToInsightAction } from "../../actions";

export const metadata = { title: "LINEで受け取った画像" };

const reasonLabel: Record<InboxImage["reason"], { label: string; tone: "amber" | "blue" | "red" }> = {
  not_insight: { label: "インサイト以外", tone: "blue" },
  no_target: { label: "どの投稿か不明", tone: "amber" },
  unclassified: { label: "判定できず", tone: "red" },
};

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  const { flash } = await searchParams;
  const [items, creators, assignments, campaigns, restaurants] = await Promise.all([
    db.list("inbox"),
    db.list("creators"),
    db.list("assignments"),
    db.list("campaigns"),
    db.list("restaurants"),
  ]);
  const cName = new Map(creators.map((c) => [c.id, c.name]));
  const camp = new Map(campaigns.map((c) => [c.id, c]));
  const rName = new Map(restaurants.map((r) => [r.id, r.name]));
  const sorted = items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const open = sorted.filter((i) => !i.doneAt);
  const done = sorted.filter((i) => i.doneAt).slice(0, 30);
  // その発信者の、インサイトを入れられる投稿（終わっていない案件・参加が決まっているもの）
  const targets = (creatorId: string) =>
    assignments
      .filter((a) => a.creatorId === creatorId && a.status === "accepted" && camp.get(a.campaignId) && !camp.get(a.campaignId)!.reportSentAt)
      .map((a) => {
        const c = camp.get(a.campaignId)!;
        return { id: a.id, label: `${rName.get(c.restaurantId) ?? c.title}（撮影 ${slotLabel(c, a.confirmedSlotId)}）${needsInsight(a) ? "" : "・提出済み"}`, open: needsInsight(a) };
      })
      .sort((x, y) => Number(y.open) - Number(x.open));

  const card = (i: InboxImage) => {
    const t = targets(i.creatorId);
    const r = reasonLabel[i.reason];
    return (
      <li key={i.id} className="flex gap-3 rounded-xl border border-line bg-white p-3">
        <a href={`/api/ops/inbox/${i.id}`} target="_blank" rel="noopener" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- 管理者だけが見られる画像のため next/image は使わない */}
          <img src={`/api/ops/inbox/${i.id}`} alt={i.what ?? "受け取った画像"} className="h-36 w-24 rounded-lg border border-line object-cover object-top" />
        </a>
        <div className="min-w-0 flex-1 space-y-1.5 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/creators/${i.creatorId}`} className="font-bold hover:text-brand">
              {cName.get(i.creatorId) ?? "（発信者不明）"}
            </Link>
            <span className="text-xs text-muted">{fmtDateTime(i.createdAt)}</span>
            <Badge tone={r.tone}>{r.label}</Badge>
          </p>
          {i.what && <p className="text-xs text-muted">AIの判定：{i.what}</p>}
          {i.doneAt ? (
            <p className="text-xs text-emerald-700">
              {i.doneNote}（{fmtDateTime(i.doneAt)}）
            </p>
          ) : (
            <>
              {t.length > 0 && (
                <form action={inboxToInsightAction.bind(null, i.id)} className="flex flex-wrap gap-1.5">
                  <select name="assignmentId" className={`${inputClass} !w-auto max-w-full !py-1.5 text-xs`}>
                    {t.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                  <SubmitButton size="sm">インサイトとして追加</SubmitButton>
                </form>
              )}
              <div className="flex flex-wrap gap-1.5">
                <form action={inboxDoneAction.bind(null, i.id)}>
                  <SubmitButton variant="outline" size="sm">
                    確認済みにする
                  </SubmitButton>
                </form>
                <form action={inboxDeleteAction.bind(null, i.id)}>
                  <SubmitButton variant="outline" size="sm" confirm="この画像を削除します。よろしいですか？">
                    削除
                  </SubmitButton>
                </form>
              </div>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <Flash text={flash} />
      <h1 className="text-xl font-extrabold md:text-2xl">LINEで受け取った画像</h1>
      <p className="text-sm text-muted">
        発信者が公式LINEに送った画像のうち、インサイトとして自動で取り込まなかったものです（料理の写真・動画の下書きなど、またはどの投稿のインサイトか決められなかったもの）。
        本人への自動の返信はしていないので、必要なら公式LINEのチャットで返信してください。インサイトだった場合は「インサイトとして追加」で取り込めます。画像は180日で自動で消えます。
      </p>
      <Card title={`未確認 ${open.length}件`}>{open.length === 0 ? <Empty>未確認の画像はありません。</Empty> : <ul className="grid gap-2 md:grid-cols-2">{open.map(card)}</ul>}</Card>
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-bold text-muted">確認済み（最新30件）</summary>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">{done.map(card)}</ul>
        </details>
      )}
    </>
  );
}
