import type { Metadata } from "next";
import { selectStoreAction } from "@/app/actions/store";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { Badge } from "@/components/ui/Badge";
import { features } from "@/lib/features";
import { requireStoreMember } from "@/server/auth/viewer";

export const metadata: Metadata = { title: { default: "店舗管理", template: "%s｜店舗管理｜TABETUNAGU" }, robots: { index: false } };

const NAV = [
  { href: "/store", label: "ダッシュボード", exact: true },
  { href: "/store/products/new", label: "出品する" },
  { href: "/store/products", label: "出品商品", exact: true },
  { href: "/store/reservations", label: "予約状況" },
  { href: "/store/monitor", label: "受取モニター" },
  { href: "/store/orders", label: "注文（事前決済）" },
  { href: "/store/sales", label: "売上・手数料" },
  { href: "/store/qr", label: "QRコード" },
  { href: "/store/payouts", label: "売上受取設定" },
  { href: "/store/settings", label: "店舗設定・プラン" },
  { href: "/store/help", label: "使い方" },
];

/** v2（事前決済）がメインのとき: 旧フローの予約状況はナビに出さない。店頭QRは障害時の切り替え用（POC_GO_LIVE_CHECKLIST.md） */
const V2_NAV = NAV.filter((n) => n.href !== "/store/reservations").map((n) => (n.href === "/store/qr" ? { ...n, label: "QRコード（障害時用）" } : n));

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const { viewer, store } = await requireStoreMember("/store");
  return (
    <ConsoleShell
      title={store.storeName}
      badge={
        <>
          <Badge tone={store.plan === "standard" ? "dark" : "outline"}>{store.plan === "standard" ? "STANDARD" : "FREE"}</Badge>
          {store.status !== "active" && <Badge tone="clay">{store.status === "pending" ? "審査中" : "停止中"}</Badge>}
        </>
      }
      nav={features.v2Journey ? V2_NAV : NAV}
      headerExtra={
        viewer.memberships.length > 1 ? (
          <form action={selectStoreAction} className="flex items-center gap-2">
            <label htmlFor="store-switch" className="sr-only">
              店舗を切り替える
            </label>
            <select id="store-switch" name="storeId" defaultValue={store.storeId} className="field h-9 w-auto py-1 text-[13px]">
              {viewer.memberships.map((m) => (
                <option key={m.storeId} value={m.storeId}>
                  {m.storeName}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold">
              切替
            </button>
          </form>
        ) : (
          <span className="text-[12px] text-muted">{store.role === "owner" ? "オーナー" : "スタッフ"}</span>
        )
      }
    >
      {children}
    </ConsoleShell>
  );
}
