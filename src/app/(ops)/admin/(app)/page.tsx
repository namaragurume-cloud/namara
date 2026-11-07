import Link from "next/link";
import { phaseTone } from "@/components/ops/phase";
import { Badge, ButtonLink, Card, Empty, Flash } from "@/components/ops/ui";
import { fmtDate, jstDate } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { isDemo } from "@/lib/ops/demo-flag";
import { isComplete } from "@/lib/ops/insight-fields";
import { latestVideo, videoStage } from "@/lib/ops/video-state";
import { phaseLabel, phaseOf, type Row } from "@/lib/ops/service";

export const metadata = { title: "ホーム" };


export default async function AdminHome({ searchParams }: { searchParams: Promise<{ flash?: string; all?: string }> }) {
  const { flash, all } = await searchParams;
  const [campaigns, restaurants, creators, assignments] = await Promise.all([
    db.list("campaigns"),
    db.list("restaurants"),
    db.list("creators"),
    db.list("assignments"),
  ]);
  const today = jstDate();
  const rName = new Map(restaurants.map((r) => [r.id, r.name]));
  const cById = new Map(creators.map((c) => [c.id, c]));
  const items = campaigns
    .map((campaign) => {
      const rows: Row[] = assignments
        .filter((a) => a.campaignId === campaign.id)
        .flatMap((a) => (cById.get(a.creatorId) ? [{ a, creator: cById.get(a.creatorId)! }] : []));
      const phase = phaseOf({ campaign, rows }, today);
      const accepted = rows.filter((r) => r.a.status === "accepted");
      const todo: string[] = [];
      const unsent = rows.filter((r) => r.a.status === "unsent").length;
      if (unsent) todo.push(`手動送信が必要な依頼 ${unsent}件`);
      if (phase === "confirming") todo.push("回答が集まりました → 日程を確定");
      if (accepted.some((r) => r.a.confirmedNotifiedAt) && !campaign.scheduleSharedAt) todo.push("飲食店へ撮影日を共有");
      const ownerVideo = accepted.filter((r) => videoStage(r.a, campaign) === "owner_review").length;
      if (ownerVideo) todo.push(`動画の確認 ${ownerVideo}件`);
      const shopUnsent = accepted.filter((r) => videoStage(r.a, campaign) === "shop_review" && !latestVideo(r.a)?.sentToShopAt).length;
      if (shopUnsent) todo.push(`お店に動画確認を連絡 ${shopUnsent}件`);
      const shopLate = accepted.filter((r) => videoStage(r.a, campaign) === "shop_review" && r.a.videoShopRemindedAt).length;
      if (shopLate) todo.push(`お店の動画確認が止まっています ${shopLate}件`);
      const lacking = accepted.filter((r) => r.a.insight && r.a.insight.missing.length > 0 && !r.a.missingNotifiedAt).length;
      if (lacking) todo.push(`スクショ不足で本人に連絡できていない ${lacking}件`);
      if (phase === "report") todo.push("インサイトがそろいました → レポート送付");
      return {
        campaign,
        phase,
        todo,
        total: rows.filter((r) => r.a.status !== "unsent").length,
        waiting: rows.filter((r) => r.a.status === "sent").length,
        accepted: accepted.length,
        insights: accepted.filter((r) => isComplete(r.a.insight)).length,
        confirmed: accepted.filter((r) => r.a.confirmedSlotId).length,
      };
    })
    .sort((x, y) => Number(x.phase === "done") - Number(y.phase === "done") || y.campaign.createdAt.localeCompare(x.campaign.createdAt));
  const todos = items.filter((i) => i.todo.length > 0);
  const visible = all ? items : items.filter((i) => i.phase !== "done");

  return (
    <>
      <Flash text={flash} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold md:text-2xl">ホーム</h1>
        <ButtonLink href="/admin/campaigns/new">＋ 新しい案件をつくる</ButtonLink>
      </div>

      {isDemo() && (
        <Card title="デモの見どころ" className="border-amber-300 bg-amber-50">
          <ol className="grid gap-2 text-sm md:grid-cols-2">
            {[
              ["/admin/campaigns/k-kotori", "① 回答受付中の案件", "依頼の一括送信・回答の集計・撮影日の自動割り当て"],
              ["/admin/campaigns/k-taiyo", "② インサイト回収中の案件", "スクショ不足の検出と本人への連絡状況"],
              ["/p/demo-report-shiokaze", "③ 飲食店に送るレポート", "完了した案件の16:9レポート（PDF保存可）"],
              ["/m/demo-creator-1", "④ 発信者に見えるページ", "やること・月ごとの進捗・スクショ送信（はなこさん）"],
              ["/admin/monthly", "⑤ 月別の進捗", "発信者ごとに、今月の案件がどこまで進んだか"],
              ["/admin/campaigns/k-hare", "⑦ 投稿前の動画チェック", "あなたの確認 → お店の確認（お店のページは「飲食店用ページを見る」）"],
              ["/admin/campaigns/new", "⑥ 新しい案件をつくる", "店舗・PR内容・撮影候補日・投稿日の入力"],
            ].map(([href, title, sub]) => (
              <li key={href}>
                <Link href={href} target={href.startsWith("/admin") ? undefined : "_blank"} className="block rounded-xl border border-amber-200 bg-white px-4 py-3 hover:border-amber-400">
                  <b className="block">{title}</b>
                  <span className="text-xs text-muted">{sub}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card title="あなたがやること">
        {todos.length === 0 ? (
          <Empty>今やることはありません。回答・インサイトは自動で集まります。</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {todos.map((i) => (
              <li key={i.campaign.id}>
                <Link href={`/admin/campaigns/${i.campaign.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 hover:opacity-80">
                  <span className="font-bold">{rName.get(i.campaign.restaurantId)}</span>
                  <span className="text-sm text-muted">{i.campaign.title}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {i.todo.map((t) => (
                      <Badge key={t} tone="amber">
                        {t}
                      </Badge>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="案件"
        actions={
          <Link href={all ? "/admin" : "/admin?all=1"} className="text-xs font-bold text-muted underline">
            {all ? "進行中のみ表示" : "完了した案件も表示"}
          </Link>
        }
      >
        {visible.length === 0 ? (
          <Empty>
            まだ案件がありません。
            {restaurants.length === 0 ? "まず「飲食店」と「発信者」を登録してから、" : ""}「新しい案件をつくる」から始めましょう。
          </Empty>
        ) : (
          <div className="-mx-4 overflow-x-auto md:mx-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2 md:px-2">店舗・案件</th>
                  <th className="px-2 py-2">状況</th>
                  <th className="px-2 py-2">回答期限</th>
                  <th className="px-2 py-2">依頼／参加／回答待ち</th>
                  <th className="px-2 py-2">日程確定</th>
                  <th className="px-2 py-2">インサイト</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.campaign.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 md:px-2">
                      <Link href={`/admin/campaigns/${i.campaign.id}`} className="font-bold hover:text-brand">
                        {rName.get(i.campaign.restaurantId) ?? "（店舗不明）"}
                      </Link>
                      <div className="text-xs text-muted">{i.campaign.title}</div>
                    </td>
                    <td className="px-2 py-3">
                      <Badge tone={phaseTone[i.phase]}>{phaseLabel[i.phase]}</Badge>
                    </td>
                    <td className="px-2 py-3">{fmtDate(i.campaign.replyDeadline)}</td>
                    <td className="num px-2 py-3">
                      {i.total}／{i.accepted}／{i.waiting}
                    </td>
                    <td className="num px-2 py-3">
                      {i.confirmed}/{i.accepted}
                    </td>
                    <td className="num px-2 py-3">
                      {i.insights}/{i.confirmed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
