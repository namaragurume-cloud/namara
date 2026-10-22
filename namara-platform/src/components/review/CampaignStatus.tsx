import { Badge } from "@/components/ui/primitives";
import type { CampaignStatus } from "@/lib/shared/types";

const LABELS: Record<CampaignStatus, { label: string; tone: "default" | "good" | "bad" | "muted" | "ad" }> = {
  draft: { label: "下書き", tone: "muted" },
  pending_review: { label: "審査待ち", tone: "ad" },
  approved: { label: "配信中（承認済み）", tone: "good" },
  rejected: { label: "否認", tone: "bad" },
  paused: { label: "一時停止", tone: "muted" },
  stopped: { label: "配信停止", tone: "muted" },
  budget_exhausted: { label: "予算上限で停止", tone: "bad" },
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const s = LABELS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
