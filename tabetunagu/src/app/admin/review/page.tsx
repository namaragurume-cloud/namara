import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { EmptyState } from "@/components/ui/Section";
import { dateTime, yen } from "@/lib/format";
import { requireAdmin } from "@/server/auth/viewer";
import { listRequiresReview } from "@/server/services/ops";

export const metadata: Metadata = { title: "要確認の決済" };

const REASONS: Record<string, string> = {
  amount_mismatch: "金額が注文と不一致",
  store_mismatch: "店舗が注文と不一致",
  order_mismatch: "注文が不一致",
  currency_mismatch: "通貨が不一致",
  destination_mismatch: "送金先が不一致",
  application_fee_mismatch: "手数料が不一致",
  payment_intent_mismatch: "決済IDが不一致",
  refund_failed: "返金に失敗",
};

/**
 * 金額・店舗などが注文と一致しない決済、返金に失敗した決済（requires_review）。
 * この画面からは金額の変更・返金などの操作はできない。Stripe ダッシュボードで確認して対応する。
 */
export default async function AdminReviewPage() {
  await requireAdmin("/admin/review");
  const rows = await listRequiresReview();
  return (
    <div className="space-y-5">
      <PageHeader
        title="要確認の決済"
        sub="注文を paid にしなかった決済・返金に失敗した決済です。Stripe ダッシュボードで確認して対応してください（この画面から金額は変更できません）。"
      />
      {rows.length === 0 ? (
        <EmptyState title="要確認の決済はありません" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]" data-testid="review-table">
            <thead className="text-left text-[12px] text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5">注文番号</th>
                <th className="px-3 py-2.5">店舗</th>
                <th className="px-3 py-2.5 text-right">金額</th>
                <th className="px-3 py-2.5">理由</th>
                <th className="px-3 py-2.5">注文の状態</th>
                <th className="px-4 py-2.5">発生</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.paymentId} className="border-b border-line last:border-0">
                  <td className="font-en px-4 py-3">#{r.orderNumber}</td>
                  <td className="px-3 py-3">{r.storeName}</td>
                  <td className="tnum px-3 py-3 text-right">{yen(r.amount)}</td>
                  <td className="px-3 py-3">
                    {(r.failureReason ?? "")
                      .split(/[,:]/)
                      .map((code) => REASONS[code] ?? code)
                      .filter(Boolean)
                      .join("・") || "—"}
                  </td>
                  <td className="px-3 py-3">{r.orderStatus}</td>
                  <td className="tnum px-4 py-3">{dateTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
