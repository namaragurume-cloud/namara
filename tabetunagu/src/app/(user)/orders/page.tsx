import type { Metadata } from "next";
import Link from "next/link";
import { OrderCard } from "@/components/orders/OrderCard";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { EmptyState } from "@/components/ui/Section";
import { features } from "@/lib/features";
import { ORDER_FILTERS, parseOrderFilter } from "@/lib/my-orders";
import { requireViewer } from "@/server/auth/viewer";
import { listMyOrderHistory } from "@/server/services/account";
import { logEvent } from "@/server/services/events";

export const metadata: Metadata = { title: "注文履歴" };

/**
 * v2（事前決済）の注文履歴。新しい注文が上。絞り込みは「すべて・受取待ち・完了・その他」だけ。
 * 旧フローの予約は /reservations のまま（v2 では「以前の方式でのご利用履歴」として区別する）。
 */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const { tab: rawTab, page: rawPage } = await searchParams;
  const filter = ORDER_FILTERS.find((f) => f.id === (parseOrderFilter(rawTab) ?? "all"))!;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const viewer = await requireViewer("/orders");
  const now = new Date();
  const { items, hasMore } = await listMyOrderHistory(viewer.id, filter.id, { page, now });
  await logEvent("orders_viewed", { userId: viewer.id, properties: { filter: filter.id, page } });
  const href = (id: string, p = 1) => `/orders?tab=${id}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-[20px] font-bold">注文履歴</h1>
        <Link href="/reservations" className="text-[12px] font-semibold text-forest underline-offset-2 hover:underline">
          {features.v2Journey ? "以前の方式でのご利用履歴" : "予約（店頭払い）はこちら"}
        </Link>
      </div>
      <div className="grid grid-cols-4 gap-1 rounded-full bg-canvas p-1 text-[13px] font-semibold" role="tablist" aria-label="注文の絞り込み">
        {ORDER_FILTERS.map((f) => (
          <Link
            key={f.id}
            href={href(f.id)}
            role="tab"
            aria-selected={filter.id === f.id}
            className={cn(
              "flex min-h-[40px] items-center justify-center rounded-full",
              filter.id === f.id ? "bg-ink text-white" : "text-ink-2",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {filter.id === "other" && <p className="text-[12px] text-muted">未受取・返金済み・キャンセル済み・お支払い待ちの注文</p>}

      {items.length === 0 ? (
        <EmptyState
          title={page > 1 ? "これより前の注文はありません。" : filter.empty}
          action={filter.id === "all" || filter.id === "ready" ? <ButtonLink href="/products">商品を探す</ButtonLink> : undefined}
        />
      ) : (
        <ul className="space-y-2.5" data-testid="order-list">
          {items.map((o) => (
            <li key={o.id}>
              <OrderCard order={o} now={now} />
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || hasMore) && (
        <nav className="flex justify-between text-[13px] font-semibold" aria-label="ページ">
          {page > 1 ? (
            <Link href={href(filter.id, page - 1)} className="rounded-full px-3 py-2 text-forest">
              ← 新しい注文
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link href={href(filter.id, page + 1)} className="rounded-full px-3 py-2 text-forest">
              以前の注文 →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
