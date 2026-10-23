import type { Metadata } from "next";
import { Fill, LegalPage } from "@/components/legal/LegalPage";
import { cancellationSummary, getPolicySettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "キャンセルポリシー（ドラフト）" };

/** 時間などの値は platform_settings（システムの実際の動作と同じ値）から表示する */
export default async function CancellationPolicyPage() {
  const s = await getPolicySettings();
  return (
    <LegalPage title="キャンセルポリシー">
      <p className="rounded-xl bg-canvas px-4 py-3 font-semibold text-ink" data-testid="cancellation-summary">
        {cancellationSummary(s)}
      </p>
      <section>
        <h2>お客様のご都合によるキャンセル</h2>
        <ul className="list-disc pl-5">
          <li>お支払い完了から{s.userRefundWindowMinutes}分以内、かつ受取開始時刻の前であれば、注文画面からキャンセルでき、全額を返金します。</li>
          <li>上記を過ぎたあとのお客様のご都合によるキャンセル・返金は、原則としてお受けできません。</li>
          <li>返金時は、つなぐチャージを含む全額を返金し、付与したつなぐポイント（{s.orderPoints}pt）は取り消します。</li>
        </ul>
      </section>
      <section>
        <h2>店舗・システムの都合によるキャンセル</h2>
        <p>店舗の都合（品切れ等）やシステムの都合で商品をお渡しできない場合は、全額を返金します。</p>
      </section>
      <section>
        <h2>受取時間を過ぎた場合</h2>
        <p>
          受取終了時刻から{s.pickupLateGraceMinutes}分を過ぎても受取完了の操作がない場合は「未受取」となります。未受取の場合の返金は行いません。
          <Fill>【要確認】</Fill>
        </p>
      </section>
      <section>
        <h2>お支払いの期限</h2>
        <p>ご注文後{s.paymentHoldMinutes}分以内にお支払いが完了しない場合、ご注文は自動的に取り消されます。</p>
      </section>
      <section>
        <h2>返金の時期・方法</h2>
        <p>
          お支払いに使用した方法で返金します。反映までの期間はカード会社等により異なります。<Fill>【要確認】</Fill>
        </p>
      </section>
    </LegalPage>
  );
}
