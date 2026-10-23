import { Badge } from "./Badge";
import { nowMs } from "@/lib/clock";
import { productStateLabel, type ProductStateLabel } from "@/lib/store-dashboard";

const RESERVATION: Record<string, { label: string; tone: Parameters<typeof Badge>[0]["tone"] }> = {
  pending: { label: "確定待ち", tone: "sand" },
  confirmed: { label: "予約中", tone: "green" },
  completed: { label: "食べつなぎ完了", tone: "dark" },
  cancelled: { label: "キャンセル", tone: "outline" },
  no_show: { label: "未来店", tone: "clay" },
  expired: { label: "期限切れ", tone: "outline" },
};

export function ReservationStatusBadge({ status, pickupEndAt }: { status: string; pickupEndAt?: string }) {
  if ((status === "confirmed" || status === "pending") && pickupEndAt && Date.parse(pickupEndAt) + 30 * 60_000 < nowMs()) {
    return <Badge tone="clay">受取時間終了</Badge>;
  }
  const s = RESERVATION[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const PRODUCT_TONE: Record<ProductStateLabel, Parameters<typeof Badge>[0]["tone"]> = {
  公開中: "green",
  売り切れ: "dark",
  受付終了: "outline",
  下書き: "sand",
  非公開: "sand",
};

/**
 * 店舗の商品管理での状態: 公開中 / 売り切れ / 受付終了 / 下書き / 非公開（受付停止）
 * 受取終了時刻を過ぎた商品は、状態の更新前でも「受付終了」と表示する（lib/store-dashboard）。
 */
export function ProductStatusBadge({ status, pickupEndAt }: { status: string; pickupEndAt?: string }) {
  const label = productStateLabel(status, pickupEndAt, nowMs());
  return (
    <Badge tone={PRODUCT_TONE[label]}>
      <span data-testid="product-state">{label}</span>
    </Badge>
  );
}
