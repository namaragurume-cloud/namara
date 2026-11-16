import { SubmitButton } from "@/components/ops/client";
import { Card } from "@/components/ops/ui";
import { todayNoticePreview } from "@/lib/ops/service";
import { todayNoticeAction } from "../actions";

/**
 * 今日のお知らせ（撮影日・投稿予定日の当日分）で、まだ送っていないもの。
 * 毎朝9時に自動で送りますが、そのあとに確定した予定や、自動処理が動かなかった日のために手動でも送れます。
 */
export async function TodayNotice({ campaignId }: { campaignId?: string }) {
  const p = await todayNoticePreview(campaignId);
  if (p.restaurants.length === 0 && p.creators.length === 0) return null;
  const who = [p.restaurants.length ? `お店：${p.restaurants.join("、")}` : "", p.creators.length ? `発信者：${p.creators.map((n) => `${n}さん`).join("、")}` : ""].filter(Boolean);
  return (
    <Card title="今日のお知らせ（撮影日・投稿予定日の当日分）が、まだ送られていません" className="border-sky-200 bg-sky-50">
      <p className="text-sm">{who.join("　／　")}</p>
      <p className="mt-1 text-xs text-muted">毎朝9時に自動で送ります。9時より後に予定が決まったときや、今日の自動送信が動かなかったときは、ここから送れます（送っていない分だけ送ります）。</p>
      <form action={todayNoticeAction.bind(null, campaignId)} className="mt-3">
        <SubmitButton confirm={`今日のお知らせを送ります（${who.join(" / ")}）。よろしいですか？`}>今日のお知らせを今すぐ送る</SubmitButton>
      </form>
    </Card>
  );
}
