import { ChevronRight, LogOut } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { LineFeaturedOptInForm } from "@/components/forms/LineFeaturedOptInForm";
import { Badge } from "@/components/ui/Badge";
import { SectionTitle } from "@/components/ui/Section";
import { areaLabel } from "@/lib/categories";
import { grams } from "@/lib/format";
import { features } from "@/lib/features";
import { requireViewer } from "@/server/auth/viewer";
import { getFeaturedOptIn } from "@/server/services/line-digest";
import { getMyStats, listFavoriteStores } from "@/server/services/reservations";
import { V2MyPage } from "@/components/account/V2MyPage";

export const metadata: Metadata = { title: "マイページ" };

export default async function MyPage() {
  if (features.v2Journey) return <V2MyPage />;
  return <LegacyMyPage />;
}

/** 旧フロー（予約 → 店頭 QR）のマイページ。ENABLE_V2_CHECKOUT が OFF のときはこれまでどおり */
async function LegacyMyPage() {
  const viewer = await requireViewer("/me");
  const [stats, favorites, optIn] = await Promise.all([getMyStats(viewer.id), listFavoriteStores(viewer.id), getFeaturedOptIn(viewer.id)]);
  const v2 = features.v2Journey;
  // v2 では、旧フローの完了と v2 の受取完了を合わせて表示する（それぞれ別のテーブルなので二重には数えない）
  const completed = v2 ? stats.completedCount + stats.v2PickedUpCount : stats.completedCount;
  const saved = v2 ? stats.foodSavedG + stats.v2FoodSavedG : stats.foodSavedG;

  return (
    <div className="space-y-7">
      <section className="flex items-center gap-3">
        {viewer.avatarUrl ? (
          <Image src={viewer.avatarUrl} alt="" width={52} height={52} className="h-13 w-13 rounded-full object-cover" />
        ) : (
          <span className="flex h-13 w-13 items-center justify-center rounded-full bg-sand text-[18px] font-bold text-ink-2">
            {Array.from(viewer.displayName)[0]}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[18px] font-bold">{viewer.displayName}</p>
          <div className="mt-0.5 flex gap-1.5">
            {viewer.lineLinked ? <Badge tone="green">LINE連携済み</Badge> : <Badge tone="outline">LINE未連携</Badge>}
            {viewer.isDemo && <Badge tone="sand">デモ</Badge>}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-canvas px-3 py-3.5">
          <p className="text-[11px] text-muted">食べつなぎ回数</p>
          <p className="tnum mt-1 text-[22px] font-semibold">
            {completed}
            <span className="text-[11px]">回</span>
          </p>
        </div>
        <div className="rounded-2xl bg-canvas px-3 py-3.5">
          <p className="text-[11px] text-muted">ポイント</p>
          <p className="tnum mt-1 text-[22px] font-semibold text-forest" data-testid="my-points">
            {stats.points}
            <span className="text-[11px]">pt</span>
          </p>
        </div>
        <div className="rounded-2xl bg-canvas px-3 py-3.5">
          <p className="text-[11px] text-muted">推定削減量</p>
          <p className="tnum mt-1 text-[22px] font-semibold">{grams(saved)}</p>
        </div>
      </section>

      <nav className="card divide-y divide-line">
        {[
          ...(v2
            ? [
                { href: "/orders?tab=ready", label: "受取待ちの注文（受取チケット）" },
                { href: "/orders?tab=picked_up", label: "注文履歴" },
                { href: "/favorites", label: "お気に入り店舗" },
                { href: "/reservations?tab=past", label: "以前の方式でのご利用履歴" },
              ]
            : [
                { href: "/reservations", label: "今後の予約" },
                { href: "/reservations?tab=past", label: "予約履歴（過去の食べつなぎ）" },
              ]),
          ...(viewer.memberships.length ? [{ href: "/store", label: "店舗管理画面" }] : []),
          ...(viewer.isAdmin ? [{ href: "/admin", label: "運営管理画面" }] : []),
        ].map((item) => (
          <Link key={item.href} href={item.href} className="flex items-center justify-between px-4 py-3.5 text-[14px] font-semibold">
            {item.label}
            <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
          </Link>
        ))}
      </nav>

      <section>
        <SectionTitle title="お気に入り店舗" />
        {favorites.length === 0 ? (
          <p className="text-[13px] text-muted">店舗ページの「お気に入りに追加」から登録できます。</p>
        ) : (
          <ul className="space-y-2">
            {favorites.map((s) => (
              <li key={s.id}>
                <Link href={`/stores/${s.slug}`} className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3">
                  <span>
                    <span className="block text-[14px] font-bold">{s.name}</span>
                    <span className="block text-[12px] text-muted">{areaLabel(s.area_id)}</span>
                  </span>
                  {s.live > 0 ? <Badge tone="green">出品中 {s.live}件</Badge> : <Badge tone="outline">本日なし</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle title="LINE通知" />
        <div className="card p-4">
          <LineFeaturedOptInForm on={optIn.on} lineLinked={optIn.lineLinked} />
        </div>
      </section>

      <form action={logoutAction}>
        <button type="submit" className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
          <LogOut className="h-4 w-4" aria-hidden />
          ログアウト
        </button>
      </form>
    </div>
  );
}
