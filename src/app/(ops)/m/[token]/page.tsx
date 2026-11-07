import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoBanner } from "@/components/ops/DemoBanner";
import { ProgressSteps } from "@/components/ops/ProgressSteps";
import { Badge, Card, Flash, buttonClass } from "@/components/ops/ui";
import { fmtDate, fmtParty, jstDate } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { lineOaMessageUrl } from "@/lib/ops/line";
import { fmtMonth, monthOf, progressOf, type Progress } from "@/lib/ops/progress";
import { findCreatorByToken, slotLabel } from "@/lib/ops/service";
import type { Assignment, Campaign } from "@/lib/ops/types";

export const metadata = { title: "PRのご依頼" };

type Item = { a: Assignment; c: Campaign; shop: string; p: Progress };

export default async function CreatorHome({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ flash?: string }> }) {
  const [{ token }, { flash }] = await Promise.all([params, searchParams]);
  const creator = await findCreatorByToken(token);
  if (!creator) notFound();
  const [assignments, campaigns, restaurants] = await Promise.all([db.list("assignments"), db.list("campaigns"), db.list("restaurants")]);
  const cMap = new Map(campaigns.map((c) => [c.id, c]));
  const rMap = new Map(restaurants.map((r) => [r.id, r.name]));
  const today = jstDate();
  const items: Item[] = assignments
    .filter((a) => a.creatorId === creator.id && a.status !== "unsent" && cMap.has(a.campaignId))
    .map((a) => {
      const c = cMap.get(a.campaignId)!;
      return { a, c, shop: rMap.get(c.restaurantId) ?? c.title, p: progressOf(a, c, today) };
    })
    .sort((x, y) => (y.a.sentAt ?? y.a.createdAt).localeCompare(x.a.sentAt ?? x.a.createdAt));

  const todo = items.filter((i) => i.p.actionNeeded);
  const months = [...new Set(items.map((i) => monthOf(i.a)))].sort().reverse();
  const recent = months.slice(0, 6);
  const older = months.slice(6);
  const lineUrl = !creator.lineUserId ? lineOaMessageUrl(`連携 ${creator.lineLinkCode}`) : undefined;

  const card = (i: Item) => {
    const slot = i.c.slots.find((s) => s.id === i.a.confirmedSlotId);
    return (
      <li key={i.a.id}>
        <Link href={`/m/${token}/${i.a.id}`} className="block rounded-xl border border-line bg-white p-3 hover:border-zinc-400">
          <div className="flex items-start gap-2">
            <span className="min-w-0 flex-1">
              <b className="block truncate">{i.shop}</b>
              <span className="block truncate text-xs text-muted">{i.c.title}</span>
            </span>
            <Badge tone={i.p.tone}>{i.p.status}</Badge>
          </div>
          {!i.p.closed && (
            <div className="mt-2.5 overflow-x-auto">
              <ProgressSteps p={i.p} compact />
            </div>
          )}
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
            {i.a.status === "accepted" && (
              <>
                <dt className="text-muted">撮影</dt>
                <dd>{slot ? slotLabel(i.c, slot.id) : "調整中"}</dd>
                <dt className="text-muted">投稿日</dt>
                <dd>{i.a.plannedPostDate ? fmtDate(i.a.plannedPostDate) : "未定"}</dd>
                <dt className="text-muted">来店人数</dt>
                <dd>{fmtParty(i.a.partySize)}</dd>
              </>
            )}
            {i.c.offer && i.a.status !== "declined" && (
              <>
                <dt className="text-muted">報酬・特典</dt>
                <dd className="truncate">{i.c.offer}</dd>
              </>
            )}
          </dl>
        </Link>
      </li>
    );
  };

  const month = (ym: string) => {
    const list = items.filter((i) => monthOf(i.a) === ym);
    const joined = list.filter((i) => i.a.status === "accepted");
    const finished = joined.filter((i) => i.p.steps.at(-1)?.state === "done" || i.p.steps.at(-1)?.state === "current");
    return (
      <section key={ym}>
        <h3 className="mb-2 flex flex-wrap items-baseline gap-x-3 px-1">
          <span className="text-base font-extrabold">{fmtMonth(ym)}</span>
          <span className="text-xs text-muted">
            依頼 {list.length}件・参加 {joined.length}件・インサイト提出済み {finished.length}/{joined.length}
          </span>
        </h3>
        <ul className="space-y-2">{list.map(card)}</ul>
      </section>
    );
  };

  return (
    <>
      <DemoBanner who="creator" />
      <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
        <header>
          <p className="text-xs font-bold tracking-widest text-brand">MIRATSUMU</p>
          <h1 className="text-xl font-extrabold">{creator.name}さんのページ</h1>
          <p className="mt-1 text-xs text-muted">このページのURLはあなた専用です。他の人に共有しないでください。</p>
        </header>
        <Flash text={flash} />
        {lineUrl && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="font-bold">公式LINEと連携すると、依頼がLINEで届き、スクショもLINEで送れます</p>
            <a href={lineUrl} className={`${buttonClass("primary")} mt-3 !bg-[#06C755]`}>
              LINEで連携する（コード {creator.lineLinkCode}）
            </a>
          </div>
        )}

        <Card title="いまやること">
          {todo.length === 0 ? (
            <p className="text-sm text-muted">今やることはありません。撮影日・投稿日や月末のスクショのお願いは、近くなったらお知らせします。</p>
          ) : (
            <ul className="space-y-2">
              {todo.map((i) => (
                <li key={i.a.id}>
                  <Link href={`/m/${token}/${i.a.id}`} className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 hover:border-rose-400">
                    <span className="min-w-0 flex-1">
                      <b className="block truncate">{i.shop}</b>
                      <span className="block text-xs text-rose-800">{i.p.next?.text}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold text-rose-800">{i.a.status === "sent" ? "回答する ›" : "送る ›"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <p className="px-1 text-xs text-muted">
            進捗は自動で更新されます（回答 → 撮影 → 投稿 → インサイト → 完了）。「投稿」は投稿日を過ぎると自動で済みになるので、投稿したことの連絡は不要です。
          </p>
          {months.length === 0 && <Card>まだ依頼はありません。</Card>}
          {recent.map(month)}
          {older.length > 0 && (
            <details>
              <summary className="cursor-pointer px-1 text-sm font-bold text-muted">それより前の依頼（{older.length}か月分）</summary>
              <div className="mt-4 space-y-6">{older.map(month)}</div>
            </details>
          )}
        </div>
      </div>
    </>
  );
}
