import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

export function AdminFrame({ active, accountLabel, children }: { active: "overview" | "stores" | "ads" | "plans"; accountLabel: string; children: ReactNode }) {
  return (
    <AppShell
      product="NAMARA 運営管理"
      tone="admin"
      accountLabel={accountLabel}
      nav={[
        { href: "/admin", label: "概要・検索需要", active: active === "overview" },
        { href: "/admin/stores", label: "店舗マスター", active: active === "stores" },
        { href: "/admin/ads", label: "広告審査・配信", active: active === "ads" },
        { href: "/admin/plans", label: "料金プラン・連携状況", active: active === "plans" },
        { href: "#support", label: "顧客サポート", soon: true },
        { href: "#pr", label: "PR相談案件", soon: true },
        { href: "#research", label: "消費者リサーチ案件", soon: true },
      ]}
    >
      {children}
    </AppShell>
  );
}
