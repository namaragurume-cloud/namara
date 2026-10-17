import { Badge } from "../ui/Badge";

export function FlagBadge({ flag }: { flag: "ok" | "warning" | "suspicious" | "insufficient" }) {
  if (flag === "suspicious") return <Badge tone="clay">要確認</Badge>;
  if (flag === "warning") return <Badge tone="sand">注意</Badge>;
  if (flag === "insufficient") return <Badge tone="outline">データ少</Badge>;
  return <Badge tone="green">良好</Badge>;
}
