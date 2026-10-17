import { Badge } from "./Badge";
import { nowMs } from "@/lib/clock";

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

const PRODUCT: Record<string, { label: string; tone: Parameters<typeof Badge>[0]["tone"] }> = {
  draft: { label: "下書き", tone: "sand" },
  published: { label: "公開中", tone: "green" },
  sold_out: { label: "完売", tone: "dark" },
  closed: { label: "受付終了", tone: "outline" },
  deleted: { label: "削除済み", tone: "outline" },
};

export function ProductStatusBadge({ status }: { status: string }) {
  const s = PRODUCT[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
