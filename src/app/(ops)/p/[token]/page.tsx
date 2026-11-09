import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/ops/client";
import { AutoRefresh } from "@/components/ops/AutoRefresh";
import { DemoBanner } from "@/components/ops/DemoBanner";
import { RestaurantLive } from "@/components/ops/RestaurantLive";
import { ReportSlides } from "@/components/ops/report/Report";
import { Card, Flash } from "@/components/ops/ui";
import { ShopVideos } from "@/components/ops/ShopVideos";
import { videoEnabled } from "@/lib/ops/video-state";
import { isAdmin } from "@/lib/ops/auth";
import { fmtDate, fmtSlot, jstDate } from "@/lib/ops/dates";
import { buildReport } from "@/lib/ops/report";
import { findCampaignByShareToken, loadBundle, slotById } from "@/lib/ops/service";

export const metadata = { title: "PRのご報告" };

/** 印刷・PDF保存は16:9のスライド1枚＝1ページ */
const PRINT_CSS = `
@page { size: 297mm 167.06mm; margin: 0; }
@media print {
  html, body { background: #fff !important; }
  .report-slide { width: 297mm !important; max-width: none !important; height: 167.06mm !important; aspect-ratio: auto !important;
    border: 0 !important; border-radius: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; zoom: 1; }
  .report-slide:last-child { break-after: auto; page-break-after: auto; }
}`;

export default async function RestaurantPortal({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ flash?: string }> }) {
  const [{ token }, { flash }] = await Promise.all([params, searchParams]);
  const found = await findCampaignByShareToken(token);
  const b = found ? await loadBundle(found.id) : null;
  if (!b) notFound();
  const admin = await isAdmin();
  const { campaign: c, restaurant } = b;
  const live = Boolean(c.liveShare);
  const showSchedule = !live && (admin || Boolean(c.scheduleSharedAt));
  const showReport = admin || Boolean(c.reportSentAt);
  const schedule = b.rows
    .filter((r) => r.a.status === "accepted" && r.a.confirmedSlotId && (admin || r.a.confirmedNotifiedAt))
    .map((r) => ({ ...r, slot: slotById(c, r.a.confirmedSlotId)! }))
    .filter((r) => r.slot)
    .sort((x, y) => `${x.slot.date}${x.slot.start}`.localeCompare(`${y.slot.date}${y.slot.start}`));
  const report = buildReport(b);

  return (
    <>
    <DemoBanner who="restaurant" />
    <div className="mx-auto max-w-[1148px] space-y-6 px-4 py-6 print:max-w-none print:space-y-0 print:p-0">
      <style>{PRINT_CSS}</style>
      {admin && (
        <p className="rounded-xl bg-amber-100 px-4 py-2 text-xs text-amber-900 print:hidden">
          管理者として表示中です。飲食店には{" "}
          {[live ? "撮影・投稿の状況（リアルタイム）" : c.scheduleSharedAt && "撮影日程", c.reportSentAt && "レポート"].filter(Boolean).join("と") || "まだ何も"}
          が表示されています。
        </p>
      )}
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <Image src="/images/brand/miratsumu-wordmark.png" alt="MIRATSUMU" width={700} height={75} className="h-5 w-auto" />
          <h1 className="mt-3 text-2xl font-extrabold">{restaurant?.name} 様</h1>
          <p className="text-sm text-muted">{c.title}</p>
        </div>
        {showReport && report.submitted > 0 && <PrintButton />}
      </header>

      <Flash text={flash} />
      {videoEnabled(c) && <ShopVideos token={token} campaign={c} rows={b.rows} />}

      {!live && !showSchedule && !showReport && <Card>撮影日が決まりましたら、こちらでご案内いたします。</Card>}

      {live && (
        <>
          <AutoRefresh seconds={60} />
          <RestaurantLive campaign={c} rows={b.rows} today={jstDate()} updatedAt={new Date().toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" })} />
        </>
      )}

      {showSchedule && (
        <Card title="撮影日・投稿日" className="print:hidden">
          {schedule.length === 0 ? (
            <p className="text-sm text-muted">調整中です。</p>
          ) : (
            <div className="-mx-4 overflow-x-auto md:mx-0">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2 md:px-2">撮影日時</th>
                    <th className="px-2 py-2">発信者</th>
                    <th className="px-2 py-2">投稿日</th>
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
                      <td className="px-2 py-2.5">{r.a.plannedPostDate ? fmtDate(r.a.plannedPostDate) : "調整中"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {showReport && report.submitted > 0 && (
        <section id="report" className="space-y-3 print:space-y-0">
          <p className="text-sm text-muted print:hidden">PR結果レポート（「PDFで保存・印刷」から横向きのPDFにできます）</p>
          <ReportSlides campaign={c} restaurant={restaurant} report={report} />
        </section>
      )}
      <footer className="pt-2 text-center text-xs text-muted print:hidden">MIRATSUMU（なまらグルメ）</footer>
    </div>
    </>
  );
}
