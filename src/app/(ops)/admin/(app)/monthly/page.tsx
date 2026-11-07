import Link from "next/link";
import { ProgressSteps } from "@/components/ops/ProgressSteps";
import { Badge, ButtonLink, Card, Empty, Stat } from "@/components/ops/ui";
import { fmtDate, jstDate } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { fmtMonth, monthOf, progressOf, shiftMonth, type Progress } from "@/lib/ops/progress";
import { slotLabel } from "@/lib/ops/service";
import type { Assignment, Campaign, Creator } from "@/lib/ops/types";

export const metadata = { title: "月別の進捗" };

type Row = { a: Assignment; c: Campaign; shop: string; p: Progress };

export default async function MonthlyPage({ searchParams }: { searchParams: Promise<{ m?: string; only?: string }> }) {
  const { m, only } = await searchParams;
  const today = jstDate();
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : today.slice(0, 7);
  const [assignments, campaigns, restaurants, creators] = await Promise.all([db.list("assignments"), db.list("campaigns"), db.list("restaurants"), db.list("creators")]);
  const cMap = new Map(campaigns.map((c) => [c.id, c]));
  const rMap = new Map(restaurants.map((r) => [r.id, r.name]));
  const rows: (Row & { creator: Creator })[] = assignments
    .filter((a) => monthOf(a) === month && cMap.has(a.campaignId))
    .flatMap((a) => {
      const creator = creators.find((x) => x.id === a.creatorId);
      const c = cMap.get(a.campaignId)!;
      return creator ? [{ a, c, creator, shop: rMap.get(c.restaurantId) ?? c.title, p: progressOf(a, c, today) }] : [];
    });
  const joined = rows.filter((r) => r.a.status === "accepted");
  const shot = joined.filter((r) => r.p.steps[1]?.state === "done");
  const insightDone = joined.filter((r) => ["current", "done"].includes(r.p.steps.find((s) => s.key === "done")?.state ?? ""));
  const waitingCreator = rows.filter((r) => r.p.actionNeeded);
  const waitingMe = rows.filter((r) => r.p.next?.who === "admin");
  const waitingShop = rows.filter((r) => r.p.next?.who === "shop");
  const shown = only === "creator" ? waitingCreator : only === "me" ? waitingMe : only === "shop" ? waitingShop : rows;

  const byCreator = new Map<string, (Row & { creator: Creator })[]>();
  for (const r of shown) byCreator.set(r.creator.id, [...(byCreator.get(r.creator.id) ?? []), r]);
  const groups = [...byCreator.values()].sort((x, y) => x[0].creator.name.localeCompare(y[0].creator.name, "ja"));
  const q = (extra: Record<string, string | undefined>) => {
    const s = new URLSearchParams(Object.entries({ m: month, only, ...extra }).filter(([, v]) => v) as [string, string][]);
    return `/admin/monthly?${s}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-extrabold md:text-2xl">月別の進捗</h1>
        <div className="ml-auto flex items-center gap-1">
          <ButtonLink href={q({ m: shiftMonth(month, -1) })} variant="outline" size="sm" aria-label="前の月">
            ‹
          </ButtonLink>
          <b className="num w-28 text-center">{fmtMonth(month)}</b>
          <ButtonLink href={q({ m: shiftMonth(month, 1) })} variant="outline" size="sm" aria-label="次の月">
            ›
          </ButtonLink>
        </div>
      </div>
      <p className="text-sm text-muted">その月に依頼した案件の進み具合です。回答・撮影日・投稿日・スクショ・レポート送付から自動で判定するので、発信者の入力は増えません。</p>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Stat label="依頼" value={rows.length} sub={`参加 ${joined.length}件`} />
        <Stat label="撮影済み" value={`${shot.length}/${joined.length}`} />
        <Stat label="インサイトそろった" value={`${insightDone.length}/${joined.length}`} />
        <Stat label="発信者の対応待ち" value={waitingCreator.length} sub="回答・スクショ" />
        <Stat label="あなたの対応待ち" value={waitingMe.length} sub="日程確定・レポート送付" />
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {[
          [undefined, `すべて（${rows.length}）`],
          ["creator", `発信者の対応待ち（${waitingCreator.length}）`],
          ["me", `あなたの対応待ち（${waitingMe.length}）`],
          ...(waitingShop.length ? [["shop", `お店の確認待ち（${waitingShop.length}）`]] : []),
        ].map(([key, label]) => (
          <Link key={label} href={q({ only: key })} className={`rounded-full border px-3 py-1 font-bold ${only === key ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:text-ink"}`}>
            {label}
          </Link>
        ))}
      </div>

      {groups.length === 0 ? (
        <Card>
          <Empty>この月の依頼はありません。</Empty>
        </Card>
      ) : (
        groups.map((list) => {
          const cr = list[0].creator;
          return (
            <Card
              key={cr.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/creators/${cr.id}`} className="hover:text-brand">
                    {cr.name}
                  </Link>
                  {cr.account && <span className="text-sm font-normal text-muted">@{cr.account}</span>}
                  {cr.lineUserId ? <Badge tone="green">LINE</Badge> : cr.email ? <Badge tone="blue">メール</Badge> : <Badge tone="red">連絡手段なし</Badge>}
                </span>
              }
              actions={<span className="text-xs text-muted">{list.length}件</span>}
            >
              <ul className="divide-y divide-line">
                {list.map((r) => (
                  <li key={r.a.id} className="grid gap-2 py-3 md:grid-cols-[1.3fr_1fr_auto] md:items-center">
                    <div className="min-w-0">
                      <Link href={`/admin/campaigns/${r.c.id}`} className="font-bold hover:text-brand">
                        {r.shop}
                      </Link>
                      <span className="ml-2 text-xs text-muted">{r.c.title}</span>
                      {r.a.status === "accepted" && (
                        <p className="text-xs text-muted">
                          撮影 {r.a.confirmedSlotId ? slotLabel(r.c, r.a.confirmedSlotId) : "調整中"}・投稿 {r.a.plannedPostDate ? fmtDate(r.a.plannedPostDate) : "未定"}
                        </p>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <ProgressSteps p={r.p} compact />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <Badge tone={r.p.tone}>{r.p.status}</Badge>
                      {r.p.next && r.p.next.who !== "none" && (
                        <span className={`text-xs ${r.p.next.who === "admin" ? "font-bold text-brand" : "text-muted"}`}>
                          {r.p.next.who === "admin" ? "あなた：" : r.p.next.who === "shop" ? "お店：" : "発信者："}
                          {r.p.next.text}
                        </span>
                      )}
                      <Link href={`/admin/assignments/${r.a.id}`} className="text-xs text-muted underline">
                        詳細
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}
    </>
  );
}
