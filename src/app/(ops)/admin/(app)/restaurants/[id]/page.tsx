import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton, SubmitButton } from "@/components/ops/client";
import { Badge, ButtonLink, Card, Flash, buttonClass } from "@/components/ops/ui";
import { lineOaMessageUrl, lineShareUrl } from "@/lib/ops/line";
import { text } from "@/lib/ops/templates";
import { newLinkCode } from "@/lib/ops/util";
import { deleteRestaurant, unlinkRestaurantLine } from "../../../actions";
import { fmtDate } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { RestaurantForm } from "../form";

export const metadata = { title: "飲食店の詳細" };

export default async function RestaurantPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ flash?: string }> }) {
  const [{ id }, { flash }] = await Promise.all([params, searchParams]);
  let r = await db.get("restaurants", id);
  if (!r) notFound();
  // 以前に登録した店舗には連携コードがないので、ここで作る
  if (!r.lineLinkCode) r = (await db.update("restaurants", id, (x) => ({ ...x, lineLinkCode: newLinkCode() })))!;
  const lineUrl = lineOaMessageUrl(`連携 ${r.lineLinkCode}`);
  const onboarding = await text("restaurantOnboarding", {
    店舗名: r.name,
    宛名: r.contactName ? `${r.contactName}様` : "ご担当者様",
    連携コード: r.lineLinkCode,
    連携リンク: lineUrl ? `（こちらを押すとコードが入力された状態でトークが開きます）\n${lineUrl}` : undefined,
  });
  const campaigns = (await db.list("campaigns")).filter((c) => c.restaurantId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <Flash text={flash} />
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/restaurants" className="text-sm text-muted">
          ← 飲食店
        </Link>
        <h1 className="text-xl font-extrabold md:text-2xl">{r.name}</h1>
        <ButtonLink href={`/admin/campaigns/new?restaurant=${r.id}`} size="sm" className="ml-auto">
          ＋ この店舗の案件をつくる
        </ButtonLink>
      </div>
      <Card title="公式LINE" actions={r.lineUserId ? <Badge tone="green">LINE連携済</Badge> : <Badge tone="amber">LINE未連携</Badge>}>
        {r.lineUserId ? (
          <>
            <p className="text-sm text-muted">撮影日程のご案内・動画の確認依頼・レポートは、このお店の公式LINEに自動で届きます。</p>
            <form action={unlinkRestaurantLine.bind(null, r.id)} className="mt-3">
              <SubmitButton variant="outline" size="sm" confirm="LINE連携を解除しますか？">
                LINE連携を解除
              </SubmitButton>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              お店が公式LINEに連携コード <b className="num tracking-widest text-ink">{r.lineLinkCode}</b> を送ると、撮影日程・動画の確認依頼・レポートが自動でLINEに届くようになります。下の案内文をお店にLINEで1回送ってください。
            </p>
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-mist p-3 text-xs leading-relaxed">{onboarding}</pre>
            <div className="mt-2 flex flex-wrap gap-2">
              <CopyButton text={onboarding} label="案内文をコピー" />
              <a href={lineShareUrl(onboarding)} target="_blank" rel="noopener" className={buttonClass("outline", "sm")}>
                LINEで送る
              </a>
            </div>
          </>
        )}
      </Card>
      <Card title="案件">
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted">まだ案件はありません。</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/campaigns/${c.id}`} className="flex gap-3 py-2 hover:text-brand">
                  <span className="font-bold">{c.title}</span>
                  <span className="ml-auto text-xs text-muted">作成 {fmtDate(c.createdAt.slice(0, 10))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="登録内容">
        <RestaurantForm r={r} />
      </Card>
      <Card title="店舗を削除" className="border-rose-200">
        <p className="text-sm text-muted">
          {campaigns.length
            ? `この店舗の案件${campaigns.length}件と、その依頼・インサイト・スクショもすべて削除されます。元には戻せません。`
            : "この店舗を削除します。元には戻せません。"}
        </p>
        <form action={deleteRestaurant.bind(null, r.id)} className="mt-3">
          <SubmitButton
            variant="danger"
            size="sm"
            confirm={campaigns.length ? `「${r.name}」と案件${campaigns.length}件をすべて削除します。元に戻せません。よろしいですか？` : `「${r.name}」を削除します。よろしいですか？`}
          >
            この店舗を削除
          </SubmitButton>
        </form>
      </Card>
    </>
  );
}
