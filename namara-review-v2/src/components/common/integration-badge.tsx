import { CheckCircle2, CircleOff, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { IntegrationStatus } from "@/lib/types";

export function IntegrationBadge({ status }: { status: IntegrationStatus }) {
  if (status === "connected")
    return (
      <Badge variant="success">
        <CheckCircle2 aria-hidden />
        接続済み
      </Badge>
    );
  if (status === "error")
    return (
      <Badge variant="destructive">
        <TriangleAlert aria-hidden />
        要再接続
      </Badge>
    );
  return (
    <Badge variant="secondary">
      <CircleOff aria-hidden />
      未接続
    </Badge>
  );
}
