import Link from "next/link";
import { notFound } from "next/navigation";
import { DemoBanner } from "@/components/ops/DemoBanner";
import { Badge, Card, Flash, buttonClass } from "@/components/ops/ui";
import { fmtDate, jstDate } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { lineOaMessageUrl } from "@/lib/ops/line";
import { isComplete } from "@/lib/ops/insight-fields";
import { needsInsight } from "@/lib/ops/insights";
import { findCreatorByToken, slotLabel } from "@/lib/ops/service";
import type { Assignment, Campaign } from "@/lib/ops/types";

export const metadata = { title: "PRのご依頼" };

export default async function CreatorHome({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ flash?: string }> }) {
  const [{ token }, { flash }] = await Promise.all([params, searchParams]);
  const creator = await findCreatorByToken(token);
  if (!creator) notFound();
  const [assignments, campaigns, restaurants] = await Promise.all([db.list("assignments"), db.list("campaigns"), db.list("restaurants")]);
  const cMap = new Map(campaigns.map((c) => [c.id, c]));
  const rMap = new Map(restaurants.map((r) => [r.id, r.name]));
  const today = jstDate();
  const mine = assignments
    .filter((a) => a.creatorId === creator.id && a.status !== "unsent" && cMap.has(a.campaignId))
    .map((a) => ({ a, c: cMap.get(a.campaignId)! }))
    .sort((x, y) => y.a.createdAt.localeCompare(x.a.createdAt));

  const answer = mine.filter(({ a, c }) => a.status === "sent" && !c.reportSentAt);
  const insight = mine.filter(({ a, c }) => needsInsight(a) && !c.reportSentAt && (a.insightRequestedAt || a.insight || (a.plannedPostDate ?? "9999") <= today));
  const upcoming = mine.filter(({ a, c }) => a.status === "accepted" && !isComplete(a.insight) && !c.reportSentAt && !insight.some((x) => x.a.id === a.id));
  const done = mine.filter((x) => !answer.includes(x) && !insight.includes(x) && !upcoming.includes(x)).slice(0, 10);
  const lineUrl = !creator.lineUserId ? lineOaMessageUrl(`連携 ${creator.lineLinkCode}`) : undefined;

  const item = ({ a, c }: { a: Assignment; c: Campaign }, badge: React.ReactNode) => (
    <li key={a.id}>
      <Link href={`/m/${token}/${a.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
        <span className="min-w-0 flex-1">
          <b className="block truncate">{rMap.get(c.restaurantId) ?? c.title}</b>
          <span className="block truncate text-xs text-muted">
            {c.title}
            {a.confirmedSlotId ? `／撮影 ${slotLabel(c, a.confirmedSlotId)}` : `／回答期限 ${fmtDate(c.replyDeadline)}`}
          </span>
        </span>
        {badge}
        <span className="text-muted">›</span>
      </Link>
    </li>
  );

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
          <p className="font-bold">公式LINEと連携すると、依頼がLINEで届きます</p>
          <a href={lineUrl} className={`${buttonClass("primary")} mt-3 !bg-[#06C755]`}>
            LINEで連携する（コード {creator.lineLinkCode}）
          </a>
        </div>
      )}
      <Card title="回答をお願いします">
        {answer.length ? (
          <ul className="divide-y divide-line">
            {answer.map((x) => item(x, <Badge tone="red">未回答</Badge>))}
          </ul>
        ) : (
          <p className="text-sm text-muted">未回答の依頼はありません。</p>
        )}
      </Card>
      {insight.length > 0 && (
        <Card title="インサイトのスクショをお願いします">
          <ul className="divide-y divide-line">
            {insight.map((x) => item(x, <Badge tone="amber">未入力</Badge>))}
          </ul>
        </Card>
      )}
      <Card title="参加予定">
        {upcoming.length ? (
          <ul className="divide-y divide-line">
            {upcoming.map((x) => item(x, x.a.confirmedNotifiedAt ? <Badge tone="green">確定</Badge> : <Badge>日程調整中</Badge>))}
          </ul>
        ) : (
          <p className="text-sm text-muted">予定はありません。</p>
        )}
      </Card>
      {done.length > 0 && (
        <Card title="これまで">
          <ul className="divide-y divide-line">
            {done.map((x) => item(x, <Badge>{x.a.status === "declined" ? "見送り" : x.a.insight ? "提出済" : "終了"}</Badge>))}
          </ul>
        </Card>
      )}
    </div>
    </>
  );
}
