import { CircleCheck, Clock, Hourglass, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CancelPendingOrderForm, ResumeCheckoutForm, UserRefundForm } from "@/components/orders/OrderActions";
import { PaymentStatusPoller } from "@/components/orders/PaymentStatusPoller";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Section";
import { dateTime, pickupLabel, yen } from "@/lib/format";
import { ORDER_POLICY } from "@/lib/orders";
import { requireViewer } from "@/server/auth/viewer";
import { getMyOrder, type MyOrderView } from "@/server/services/payments";

export const metadata: Metadata = { title: "ご注文" };

/**
 * v2 注文詳細・決済確認。Stripe から戻ったとき（?from=checkout）も、表示はサーバーの注文状態だけで決める。
 * paid になるのは Webhook を受け取ったときだけ。
 */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const viewer = await requireViewer(`/orders/${id}`);
  const order = await getMyOrder(viewer.id, id);
  if (!order) notFound();
  const confirming = order.status === "pending_payment" && from === "checkout" && order.payable;

  return (
    <div className="space-y-5" data-testid="order-page" data-status={order.status}>
      <StatusHeader order={order} confirming={confirming} />
      {confirming && <PaymentStatusPoller />}

      <section className="rounded-2xl border border-line p-4">
        <p className="text-[12px] text-muted">注文番号</p>
        <p className="font-en text-[22px] font-semibold tracking-[0.2em]">{order.orderNumber}</p>
        <ul className="mt-3 space-y-1 text-[14px]">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {item.name} × {item.quantity}
              </span>
              <span className="tnum">{yen(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="tnum mt-3 space-y-1 border-t border-line pt-3 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-ink-2">商品小計</dt>
            <dd>{yen(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">つなぐチャージ</dt>
            <dd>{yen(order.tsunaguCharge)}</dd>
          </div>
          <div className="flex justify-between font-bold">
            <dt>お支払い合計</dt>
            <dd>{yen(order.total)}</dd>
          </div>
        </dl>
      </section>

      <dl className="space-y-3 rounded-2xl bg-canvas px-4 py-4 text-[14px]">
        <div className="flex gap-3">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <div>
            <dt className="text-[12px] text-muted">受取時間</dt>
            <dd className="tnum font-bold">{pickupLabel(order.pickupStartAt, order.pickupEndAt)}</dd>
          </div>
        </div>
        <div className="flex gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-forest" aria-hidden />
          <div>
            <dt className="text-[12px] text-muted">受取場所</dt>
            <dd className="font-bold">{order.storeName}</dd>
            {order.storeAddress && <dd className="text-[12px] text-muted">{order.storeAddress}</dd>}
          </div>
        </div>
      </dl>

      {order.status === "pending_payment" && order.payable && !confirming && (
        <div className="space-y-3">
          <p className="text-[12.5px] text-muted">お支払いの期限：{dateTime(order.paymentExpiresAt)}（期限を過ぎると注文は取り消されます）</p>
          <ResumeCheckoutForm orderId={order.id} total={order.total} />
          <CancelPendingOrderForm orderId={order.id} />
        </div>
      )}
      {order.userRefundable && <UserRefundForm orderId={order.id} windowMinutes={ORDER_POLICY.userRefundWindowMinutes} />}
      {order.productId && (order.status === "cancelled" || (order.status === "pending_payment" && !order.payable)) && (
        <ButtonLink href={`/products/${order.productId}/buy`} variant="secondary" size="lg" className="w-full">
          もう一度注文する
        </ButtonLink>
      )}
    </div>
  );
}

function StatusHeader({ order, confirming }: { order: MyOrderView; confirming: boolean }) {
  if (order.status === "paid") {
    return (
      <div className="pt-2 text-center">
        <CircleCheck className="anim-ring mx-auto h-12 w-12 text-forest" strokeWidth={1.6} aria-hidden />
        <h1 className="mt-3 text-[22px] font-bold">お支払い完了</h1>
        <p className="mt-1 text-[13px] text-muted">受取時間にお店へお越しください。</p>
      </div>
    );
  }
  if (order.status === "pending_payment") {
    if (confirming) {
      return (
        <div className="pt-2 text-center">
          <Hourglass className="mx-auto h-12 w-12 text-forest" strokeWidth={1.6} aria-hidden />
          <h1 className="mt-3 text-[22px] font-bold">お支払いを確認しています</h1>
          <p className="mt-1 text-[13px] text-muted">決済の確認まで少しお待ちください。この画面は自動で更新されます。</p>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <h1 className="text-[20px] font-bold">お支払い待ち</h1>
        <Notice tone={order.payable ? "info" : "error"}>
          {order.payable ? "お支払いが完了していません。" : "お支払いの期限が過ぎました。"}
        </Notice>
      </div>
    );
  }
  const messages: Record<string, { title: string; body: string }> = {
    picked_up: { title: "受取済み", body: "ご利用ありがとうございました。" },
    unclaimed: { title: "受取時間が終了しました", body: "受取時間内に受け取りが確認できませんでした。" },
    refunded: {
      title: "返金済み",
      body: order.refundStatus === "pending" ? "返金の手続き中です。反映まで数日かかる場合があります。" : "この注文はキャンセルし、全額を返金しました。",
    },
    cancelled:
      order.paymentStatus === "requires_refund" || order.paymentStatus === "refunded"
        ? {
            title: "注文は取り消されました",
            body: "お支払いの確認前に注文の有効期限が切れたため、お支払いいただいた金額は全額返金します。",
          }
        : { title: "注文は取り消されました", body: "お支払いは発生していません。" },
  };
  const m = messages[order.status] ?? { title: "ご注文", body: "" };
  return (
    <div className="space-y-2">
      <h1 className="text-[20px] font-bold">{m.title}</h1>
      {m.body && <Notice>{m.body}</Notice>}
    </div>
  );
}
