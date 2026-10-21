import { AlertTriangle, CheckCircle2, Circle, Clock, Loader2, PenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/constants";
import type { ReplyStatus } from "@/lib/types";

const CONFIG = {
  unreplied: { variant: "warning", icon: Circle },
  draft: { variant: "secondary", icon: PenLine },
  pending: { variant: "brand", icon: Clock },
  publishing: { variant: "brand", icon: Loader2 },
  published: { variant: "success", icon: CheckCircle2 },
  failed: { variant: "destructive", icon: AlertTriangle },
} as const;

export function StatusBadge({ status }: { status: ReplyStatus }) {
  const { variant, icon: Icon } = CONFIG[status];
  return (
    <Badge variant={variant}>
      <Icon className={status === "publishing" ? "animate-spin" : undefined} aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
