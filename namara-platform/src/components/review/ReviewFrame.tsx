import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import type { Store } from "@/lib/shared/types";

export function ReviewFrame({ active, store, stores, accountLabel, children }: { active: "dashboard" | "demand" | "ads"; store: Store; stores: Store[]; accountLabel: string; children: ReactNode }) {
  const q = `?store=${store.id}`;
  return (
    <AppShell
      product="NAMARA REVIEW"
      tone="review"
      accountLabel={accountLabel}
      nav={[
        { href: `/review${q}`, label: "ダッシュボード", active: active === "dashboard" },
        { href: `/review/demand${q}`, label: "NAMARA DEMAND（検索需要）", active: active === "demand" },
        { href: `/review/ads${q}`, label: "スポンサー広告", active: active === "ads" },
        { href: "#reviews", label: "口コミ管理", soon: true },
        { href: "#voice", label: "NAMARA VOICE", soon: true },
        { href: "#action", label: "NAMARA ACTION", soon: true },
        { href: "#boost", label: "NAMARA BOOST", soon: true },
      ]}
      toolbar={
        stores.length > 1 ? (
          <form method="get" className="flex items-center gap-1">
            <label htmlFor="store" className="sr-only">店舗を切り替え</label>
            <select id="store" name="store" defaultValue={store.id} className="max-w-[14rem] rounded border border-line bg-paper px-2 py-1 text-xs text-ink">
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button type="submit" className="rounded border border-line px-2 py-1">切替</button>
          </form>
        ) : null
      }
    >
      {children}
    </AppShell>
  );
}
