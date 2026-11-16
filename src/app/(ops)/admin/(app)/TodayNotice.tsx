import { SubmitButton } from "@/components/ops/client";
import { Card } from "@/components/ops/ui";
import { todayNoticePreview } from "@/lib/ops/service";
import { todayNoticeAction } from "../actions";

/**
 * 朝のお知らせ（お店へ明日の撮影・投稿予定、発信者へ今日の投稿予定など）で、まだ送っていないもの。
 * 毎朝9時に自動で送りますが、そのあとに確定した予定や、自動処理が動かなかった日のために手動でも送れます。
 */
export async function TodayNotice({ campaignId }: { campaignId?: string }) {
  const p = await todayNoticePreview(campaignId);
  if (p.restaurants.length === 0 && p.creators.length === 0) return null;
  const who = [p.restaurants.length ? `お店（明日の予定）：${p.restaurants.join("、")}` : "", p.creators.length ? `発信者（今日の予定）：${p.creators.map((n) => `${n}さん`).join("、")}` : ""].filter(Boolean);
  return (
    <Card title="朝のお知らせが、まだ送られていません" className="border-sky-200 bg-sky-50">
      <p className="text-sm">{who.join("　／　")}</p>
      <p className="mt-1 text-xs text-muted">お店には撮影日・投稿予定日の前日に明日の予定を、発信者には投稿予定日などの当日に、毎朝9時に自動で送っています。9時より後に予定が決まったときや、今日の自動送信が動かなかったときは、ここから送れます（送っていない分だけ送ります）。</p>
      <form action={todayNoticeAction.bind(null, campaignId)} className="mt-3">
        <SubmitButton confirm={`お知らせを送ります（${who.join(" / ")}）。よろしいですか？`}>今すぐ送る</SubmitButton>
      </form>
    </Card>
  );
}
