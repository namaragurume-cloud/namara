import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { features } from "@/lib/features";
import { dateTime } from "@/lib/format";
import { POINT_TYPE_LABEL, pointsDelta } from "@/lib/my-orders";
import { requireViewer } from "@/server/auth/viewer";
import { listMyPointHistory } from "@/server/services/account";
import { logEvent } from "@/server/services/events";
import { getPointsBalance } from "@/server/services/orders";

export const metadata: Metadata = { title: "ポイント履歴" };

/** つなぐポイントの残高と履歴（v2）。残高は台帳（points_transactions）の合計 */
export default async function PointsPage() {
  if (!features.v2Journey) notFound();
  const viewer = await requireViewer("/me/points");
  const [balance, history] = await Promise.all([getPointsBalance(viewer.id), listMyPointHistory(viewer.id)]);
  await logEvent("points_history_viewed", { userId: viewer.id });

  return (
    <div className="space-y-5">
      <Link href="/me" className="text-[13px] font-semibold text-forest">
        ← マイページ
      </Link>
      <section className="rounded-3xl bg-leaf-soft px-5 py-5 text-center">
        <h1 className="text-[14px] font-bold text-forest-2">つなぐポイント</h1>
        <p className="tnum mt-1 text-[36px] font-bold leading-tight text-forest" data-testid="points-balance">
          {balance.toLocaleString("ja-JP")}
          <span className="ml-0.5 text-[16px]">pt</span>
        </p>
        <p className="mt-1 text-[12.5px] text-ink-2">食べつなぐたびにポイントがたまります。</p>
      </section>
      <ul className="space-y-1 text-[12px] text-ink-2">
        <li>・決済完了後にポイントが付与されます。</li>
        <li>・注文を返金した場合、付与したポイントは取り消されます。</li>
      </ul>

      <section aria-labelledby="points-history-title">
        <h2 id="points-history-title" className="mb-2 text-[16px] font-bold">
          ポイント履歴
        </h2>
        {history.length === 0 ? (
          <div className="rounded-2xl bg-canvas px-4 py-6 text-center" data-testid="points-empty">
            <p className="text-[14px] font-semibold">まだポイントはありません。</p>
            <ButtonLink href="/products" className="mt-3">
              商品を探す
            </ButtonLink>
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-2xl border border-line" data-testid="points-history">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3" data-testid="points-entry" data-type={h.type}>
                <span>
                  <span className="block text-[14px] font-semibold">{POINT_TYPE_LABEL[h.type] ?? "調整"}</span>
                  <span className="tnum block text-[12px] text-muted">{dateTime(h.createdAt)}</span>
                </span>
                <span className={cn("tnum text-[16px] font-bold", h.amount > 0 ? "text-forest" : "text-ink-2")}>{pointsDelta(h.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
