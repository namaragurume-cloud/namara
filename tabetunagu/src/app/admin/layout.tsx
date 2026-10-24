import type { Metadata } from "next";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/server/auth/viewer";
import { env } from "@/server/env";

export const metadata: Metadata = { title: { default: "運営管理", template: "%s｜運営管理｜TABETUNAGU" }, robots: { index: false } };

const NAV = [
  { href: "/admin", label: "KPI", exact: true },
  { href: "/admin/stores", label: "店舗" },
  { href: "/admin/users", label: "ユーザー" },
  { href: "/admin/products", label: "商品" },
  { href: "/admin/reservations", label: "予約・成約" },
  { href: "/admin/review", label: "要確認の決済" },
  { href: "/admin/unclaimed", label: "未受取" },
  { href: "/admin/notifications", label: "通知" },
  { href: "/admin/billing", label: "請求" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin("/admin");
  return (
    <ConsoleShell
      title="運営管理"
      badge={<Badge tone="dark">ADMIN</Badge>}
      // LINE 通知デモは開発・プレビュー環境で有効にしたときだけ（本番では出さない）
      nav={env.line.serviceMessageDemoEnabled ? [...NAV, { href: "/admin/line-demo", label: "LINE通知デモ" }] : NAV}
      headerExtra={<span className="text-[12px] text-muted">{viewer.displayName}</span>}
    >
      {children}
    </ConsoleShell>
  );
}
