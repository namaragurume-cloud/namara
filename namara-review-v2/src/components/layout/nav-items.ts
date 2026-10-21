import { BarChart3, LayoutDashboard, MessageSquareText, Settings, Sparkles, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  badge?: "unreplied" | "pending";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "ダッシュボード", shortLabel: "ホーム", icon: LayoutDashboard },
  { href: "/reviews", label: "口コミ管理", shortLabel: "口コミ", icon: MessageSquareText, badge: "unreplied" },
  { href: "/replies", label: "AI返信管理", shortLabel: "AI返信", icon: Sparkles, badge: "pending" },
  { href: "/reports", label: "AI分析レポート", shortLabel: "分析", icon: BarChart3 },
  { href: "/settings", label: "店舗設定", shortLabel: "設定", icon: Settings },
];
