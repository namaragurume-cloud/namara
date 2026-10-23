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

/**
 * v2（事前決済）がメインのとき: 旧フローの予約状況・店頭QRはナビに出さない（通常の受取方法ではないため）。
 * 店頭QRは障害時の切り替え用（POC_GO_LIVE_CHECKLIST.md）で、使い方ページの「緊急時の受取対応」（オーナー向け）から開ける。
 */
const V2_NAV = [NAV[0], { href: "/store/start", label: "始める準備" }, ...NAV.slice(1).filter((n) => n.href !== "/store/reservations" && n.href !== "/store/qr")];

/** スタッフには出さない（売上の詳細・売上受取設定はオーナーが管理する） */
const OWNER_ONLY = new Set(["/store/sales", "/store/payouts"]);

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
      nav={(features.v2Journey ? V2_NAV : NAV).filter((n) => store.role === "owner" || !OWNER_ONLY.has(n.href))}
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
