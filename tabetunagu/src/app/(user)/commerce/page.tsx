import type { Metadata } from "next";
import Link from "next/link";
import { Fill, LegalPage } from "@/components/legal/LegalPage";
import { cancellationSummary, getPolicySettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "特定商取引法に基づく表記（ドラフト）" };

/** 会社情報は推測で埋めない（【要記入】のまま運営者が記入する） */
export default async function CommercePage() {
  const s = await getPolicySettings();
  const rows: [string, React.ReactNode][] = [
    ["販売事業者", <Fill key="a" />],
    ["運営責任者", <Fill key="b" />],
    ["所在地", <Fill key="c" />],
    ["電話番号", <Fill key="d" />],
    ["メールアドレス", <Fill key="e" />],
    ["販売価格", "各商品のページに表示（税込）"],
    ["商品代金以外の必要料金", `つなぐチャージ（1回のご注文ごとに${s.tsunaguChargeYen}円）。インターネット接続料金などはお客様のご負担となります。`],
    ["支払方法", <span key="f">オンライン決済（Stripe）。利用できる支払方法は決済画面に表示されます。<Fill>【要確認】</Fill></span>],
    ["支払時期", "ご注文の確定時（決済画面でお支払いを完了した時点）"],
    ["商品の引渡し時期・方法", "ご注文時に表示する受取時間内に、店舗で受取チケットを提示してお受け取りください（配送はありません）。"],
    [
      "キャンセル",
      <span key="g">
        {cancellationSummary(s)}詳しくは<Link href="/cancellation-policy" className="underline">キャンセルポリシー</Link>をご覧ください。
      </span>,
    ],
    ["返金", <span key="h">キャンセルポリシーに定める場合は全額を返金します。<Fill>【要確認】</Fill></span>],
    ["販売事業者と店舗の関係", <Fill key="i">【要記入・専門家確認】</Fill>],
  ];
  return (
    <LegalPage title="特定商取引法に基づく表記">
      <dl className="divide-y divide-line rounded-2xl border border-line" data-testid="commerce-table">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
            <dt className="text-[12.5px] font-bold text-ink">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </LegalPage>
  );
}
