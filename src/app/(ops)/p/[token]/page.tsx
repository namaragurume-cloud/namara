import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/ops/client";
import { Card, Stat } from "@/components/ops/ui";
import { fmtDate, fmtDateLong, fmtNum, fmtSlot, jstDate } from "@/lib/ops/dates";
import { isAdmin } from "@/lib/ops/auth";
import { buildReport, findCampaignByShareToken, loadBundle, pct, slotById } from "@/lib/ops/service";

export const metadata = { title: "PRのご報告" };

export default async function RestaurantPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await findCampaignByShareToken(token);
  const b = found ? await loadBundle(found.id) : null;
  if (!b) notFound();
  const admin = await isAdmin();
  const { campaign: c, restaurant } = b;
  const showSchedule = admin || Boolean(c.scheduleSharedAt);
  const showReport = admin || Boolean(c.reportSentAt);
  const schedule = b.rows
    .filter((r) => r.a.status === "accepted" && r.a.confirmedSlotId && (admin || r.a.confirmedNotifiedAt))
    .map((r) => ({ ...r, slot: slotById(c, r.a.confirmedSlotId)! }))
    .filter((r) => r.slot)
    .sort((x, y) => `${x.slot.date}${x.slot.start}`.localeCompare(`${y.slot.date}${y.slot.start}`));
  const report = buildReport(b);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 print:max-w-none print:p-0">
      {admin && (
        <p className="rounded-xl bg-amber-100 px-4 py-2 text-xs text-amber-900 print:hidden">
          管理者として表示中です。飲食店には {c.scheduleSharedAt ? "日程" : ""}
          {c.scheduleSharedAt && c.reportSentAt ? "と" : ""}
          {c.reportSentAt ? "レポート" : ""}
          {!c.scheduleSharedAt && !c.reportSentAt ? "まだ何も表示されていません" : "が表示されています"}。
        </p>
      )}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <Image src="/images/brand/miratsumu-wordmark.png" alt="MIRATSUMU" width={700} height={75} className="h-6 w-auto" />
          <h1 className="mt-3 text-2xl font-extrabold">{restaurant?.name} 様</h1>
          <p className="text-sm text-muted">{c.title}</p>
        </div>
        {showReport && report.submitted > 0 && <PrintButton />}
      </header>

      {!showSchedule && !showReport && <Card>撮影日が決まりましたら、こちらでご案内いたします。</Card>}

      {showSchedule && (
        <Card title="撮影日・投稿予定日">
          {schedule.length === 0 ? (
            <p className="text-sm text-muted">調整中です。</p>
          ) : (
            <div className="-mx-4 overflow-x-auto md:mx-0">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 md:px-2">撮影日時</th>
                    <th className="px-2 py-2">発信者</th>
                    <th className="px-2 py-2">投稿予定日</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((r) => (
                    <tr key={r.a.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 font-bold md:px-2">{fmtSlot(r.slot)}</td>
                      <td className="px-2 py-2.5">
                        {r.creator.name}
                        {r.creator.account && (
                          <a href={`https://www.instagram.com/${r.creator.account}/`} target="_blank" rel="noopener" className="ml-1 text-xs text-brand underline">
                            @{r.creator.account}
                          </a>
                        )}
                      </td>
                      <td className="px-2 py-2.5">{r.a.plannedPostDate ? fmtDate(r.a.plannedPostDate) : `${fmtDate(c.postDeadline)}まで`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {showReport && report.submitted > 0 && (
        <section id="report" className="space-y-5">
          <Card title="PR結果レポート" actions={<span className="text-xs text-muted">作成日 {fmtDateLong(jstDate())}</span>}>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="投稿数" value={`${report.submitted}件`} sub={report.followers ? `発信者フォロワー計 ${fmtNum(report.followers)}人` : undefined} />
              <Stat label="合計再生数" value={fmtNum(report.sum.views)} />
              <Stat label="合計リーチ" value={fmtNum(report.sum.reach)} sub="投稿を見たアカウント数" />
              <Stat label="エンゲージメント率" value={pct(report.rate)} sub="反応数 ÷ リーチ" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="いいね" value={fmtNum(report.sum.likes)} />
              <Stat label="保存" value={fmtNum(report.sum.saves)} sub="「行きたい」の目安" />
              <Stat label="コメント" value={fmtNum(report.sum.comments)} />
              <Stat label="シェア" value={fmtNum(report.sum.shares)} />
            </div>
            {c.reportComment && (
              <div className="mt-4 rounded-xl border border-line p-4 text-sm leading-relaxed">
                <p className="text-xs font-bold text-muted">担当者より</p>
                <p className="mt-1 whitespace-pre-wrap">{c.reportComment}</p>
              </div>
            )}
          </Card>
          <Card title="投稿ごとの結果">
            <div className="-mx-4 overflow-x-auto md:mx-0">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 md:px-2">発信者</th>
                    <th className="px-2 py-2 text-right">再生数</th>
                    <th className="px-2 py-2 text-right">リーチ</th>
                    <th className="px-2 py-2 text-right">いいね</th>
                    <th className="px-2 py-2 text-right">コメント</th>
                    <th className="px-2 py-2 text-right">保存</th>
                    <th className="px-2 py-2 text-right">シェア</th>
                    <th className="px-2 py-2 text-right">ER</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {report.rows
                    .filter((r) => r.insight)
                    .map((r) => (
                      <tr key={r.creator.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2.5 font-sans md:px-2">
                          <b>{r.creator.name}</b>
                          {r.postUrl && (
                            <a href={r.postUrl} target="_blank" rel="noopener" className="ml-2 text-xs text-brand underline print:hidden">
                              投稿を見る
                            </a>
                          )}
                          <span className="block text-xs text-muted">
                            {r.creator.followers ? `フォロワー ${fmtNum(r.creator.followers)}` : ""}
                            {r.postDate ? `　投稿 ${fmtDate(r.postDate)}` : ""}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right font-bold">{fmtNum(r.insight?.views)}</td>
                        <td className="px-2 py-2.5 text-right">{fmtNum(r.insight?.reach)}</td>
                        <td className="px-2 py-2.5 text-right">{fmtNum(r.insight?.likes)}</td>
                        <td className="px-2 py-2.5 text-right">{fmtNum(r.insight?.comments)}</td>
                        <td className="px-2 py-2.5 text-right">{fmtNum(r.insight?.saves)}</td>
                        <td className="px-2 py-2.5 text-right">{fmtNum(r.insight?.shares)}</td>
                        <td className="px-2 py-2.5 text-right">{pct(r.rate)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              ※ 数値は各発信者がInstagramのインサイトから提出した、提出時点の値です。エンゲージメント率（ER）＝（いいね＋コメント＋保存＋シェア）÷リーチ。
            </p>
          </Card>
        </section>
      )}
      <footer className="pt-4 text-center text-xs text-muted">MIRATSUMU（なまらグルメ）</footer>
    </div>
  );
}
