import { ChevronRight, Clock, Coins, Heart, LogOut, MapPin, ReceiptText, Ticket } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { NotificationSettingsForm } from "@/components/forms/NotificationSettingsForm";
import { OrderCard } from "@/components/orders/OrderCard";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { SectionTitle } from "@/components/ui/Section";
import { areaLabel } from "@/lib/categories";
import { pickupLabel } from "@/lib/format";
import { pickupHeading, pickupHint, upcomingPickups } from "@/lib/my-orders";
import { requireViewer } from "@/server/auth/viewer";
import { getMyAccountSummary, type MyOrderCard } from "@/server/services/account";
import { logEvent } from "@/server/services/events";
import { getMyProfile } from "@/server/services/reservations";

/**
 * v2 のマイページ。「次にやることが分かる」順に並べる:
 *   受取待ち（最優先）→ 受取待ち件数・ポイント・過去の食べつなぎ → 最近の注文 → お気に入り → アカウント・規約
 * 推定の食品ロス削減量などの根拠のない数値は出さない。
 */
export async function V2MyPage() {
  const viewer = await requireViewer("/me");
  const now = new Date();
  const [summary, profile] = await Promise.all([getMyAccountSummary(viewer.id, now), getMyProfile(viewer.id)]);
  await logEvent("my_page_viewed", { userId: viewer.id });
  const pickups = upcomingPickups(summary.paidOrders, now);
  const [first, ...rest] = pickups;

  return (
    <div className="space-y-6" data-testid="my-page">
      <h1 className="sr-only">マイページ</h1>

      {first && (
        <section aria-labelledby="my-pickups-title" data-testid="my-pickups">
          <SectionTitle
            id="my-pickups-title"
            title={pickupHeading(pickups, now)}
            action={
              pickups.length > 1 ? (
                <Link href="/orders?tab=ready" className="text-[13px] font-semibold text-forest">
                  すべて見る（{pickups.length}件）
                </Link>
              ) : undefined
            }
          />
          <NextPickup order={first} now={now} />
          {rest.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {rest.slice(0, 2).map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5"
                    data-testid="my-pickup-compact"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold">{o.itemsLabel}</span>
                      <span className="tnum block truncate text-[12px] text-ink-2">
                        {pickupLabel(o.pickupStartAt, o.pickupEndAt, now)}・{o.storeName}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="grid grid-cols-3 gap-2" aria-label="ご利用状況">
        <StatLink href="/orders?tab=ready" label="受取待ち" value={pickups.length} unit="件" testId="my-ready-count" Icon={Ticket} />
        <StatLink href="/me/points" label="つなぐポイント" value={summary.points} unit="pt" testId="my-points" Icon={Coins} accent />
        <StatLink href="/orders?tab=done" label="過去の食べつなぎ" value={summary.pickedUpCount} unit="回" testId="my-picked-up-count" Icon={ReceiptText} />
      </section>

      <section aria-labelledby="my-points-title" className="rounded-2xl border border-line p-4" data-testid="my-points-card">
        <div className="flex items-center justify-between gap-3">
          <h2 id="my-points-title" className="text-[15px] font-bold">
            つなぐポイント
          </h2>
          <Link href="/me/points" className="inline-flex items-center text-[13px] font-semibold text-forest">
            ポイント履歴
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <p className="mt-1 text-[13px] text-ink-2">
          {summary.points > 0 ? "食べつなぐたびにポイントがたまります。" : "まだポイントはありません。食べつなぐたびにポイントがたまります。"}
        </p>
      </section>

      <section aria-labelledby="my-orders-title">
        <SectionTitle
          id="my-orders-title"
          title="注文履歴"
          action={
            summary.orderCount > 0 ? (
              <Link href="/orders" className="text-[13px] font-semibold text-forest">
                すべて見る
              </Link>
            ) : undefined
          }
        />
        {summary.orderCount === 0 ? (
          <div className="rounded-2xl bg-canvas px-4 py-6 text-center" data-testid="my-orders-empty">
            <p className="text-[14px] font-semibold">まだ食べつないだ商品はありません。</p>
            <ButtonLink href="/products" className="mt-3">
              商品を探す
            </ButtonLink>
          </div>
        ) : summary.recentOrders.length === 0 ? (
          <p className="text-[13px] text-ink-2">受取待ちの注文は上に表示しています。</p>
        ) : (
          <ul className="space-y-2.5">
            {summary.recentOrders.map((o) => (
              <li key={o.id}>
                <OrderCard order={o} now={now} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="my-favorites-title" data-testid="my-favorites">
        <SectionTitle
          id="my-favorites-title"
          title="お気に入り店舗"
          action={
            <Link href="/favorites" className="text-[13px] font-semibold text-forest">
              {summary.favoriteCount > 0 ? `すべて見る（${summary.favoriteCount}）` : "お気に入りを見る"}
            </Link>
          }
        />
        {summary.favorites.length === 0 ? (
          <p className="flex items-start gap-2 rounded-2xl bg-canvas px-4 py-3 text-[13px] text-ink-2" data-testid="my-favorites-empty">
            <Heart className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
            気になるお店をお気に入りに追加しておくと、あとで見つけやすくなります。
          </p>
        ) : (
          <ul className="space-y-2">
            {summary.favorites.map((s) => (
              <li key={s.id}>
                <Link href={`/stores/${s.slug}`} className="flex items-center justify-between gap-2 rounded-xl bg-canvas px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-bold">{s.name}</span>
                    <span className="block text-[12px] text-muted">{areaLabel(s.areaId)}</span>
                  </span>
                  {s.live > 0 ? <Badge tone="green">出品中 {s.live}件</Badge> : <Badge tone="outline">本日なし</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="my-account-title" className="space-y-3 border-t border-line pt-5">
        <h2 id="my-account-title" className="text-[13px] font-bold text-ink-2">
          アカウント
        </h2>
        <div className="flex items-center gap-2 text-[13px]">
          <span className="truncate font-semibold">{viewer.displayName}</span>
          {viewer.lineLinked ? <Badge tone="green">LINE連携済み</Badge> : <Badge tone="outline">LINE未連携</Badge>}
          {viewer.isDemo && <Badge tone="sand">デモ</Badge>}
        </div>
        <details className="rounded-2xl border border-line">
          <summary className="flex min-h-[48px] cursor-pointer items-center px-4 text-[14px] font-semibold">通知設定</summary>
          <div className="border-t border-line p-4">
            <NotificationSettingsForm enabled={profile?.notify_enabled ?? true} areas={profile?.notify_areas ?? []} lineLinked={viewer.lineLinked} />
          </div>
        </details>
        <nav className="divide-y divide-line rounded-2xl border border-line text-[13.5px]" aria-label="その他のメニュー">
          {[
            { href: "/reservations?tab=past", label: "以前の方式でのご利用履歴" },
            ...(viewer.memberships.length ? [{ href: "/store", label: "店舗管理画面" }] : []),
            ...(viewer.isAdmin ? [{ href: "/admin", label: "運営管理画面" }] : []),
            { href: "/terms", label: "利用規約" },
            { href: "/privacy", label: "プライバシーポリシー" },
            { href: "/commerce", label: "特定商取引法に基づく表記" },
            { href: "/cancellation-policy", label: "キャンセルポリシー" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="flex min-h-[48px] items-center justify-between px-4 text-ink-2">
              {item.label}
              <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
            </Link>
          ))}
        </nav>
        <form action={logoutAction}>
          <button type="submit" className="flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-muted">
            <LogOut className="h-4 w-4" aria-hidden />
            ログアウト
          </button>
        </form>
      </section>
    </div>
  );
}

/** 次の受取（最優先で大きく）。補助表示は受取チケットと同じ ticketTiming から */
function NextPickup({ order: o, now }: { order: MyOrderCard; now: Date }) {
  const hint = pickupHint(o, now);
  return (
    <div className="rounded-3xl border-2 border-forest bg-paper p-4" data-testid="my-next-pickup">
      <p className="text-[18px] font-bold leading-snug">{o.itemsLabel}</p>
      <p className="tnum mt-1.5 flex items-center gap-1.5 text-[20px] font-bold">
        <Clock className="h-5 w-5 shrink-0 text-forest" aria-hidden />
        {pickupLabel(o.pickupStartAt, o.pickupEndAt, now)}
      </p>
      {hint && (
        <p className={cn("tnum mt-0.5 pl-[26px] text-[13px] font-bold", hint.urgent ? "text-clay" : "text-ink-2")} data-testid="my-next-pickup-hint">
          {hint.text}
        </p>
      )}
      <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-ink-2">
        <MapPin className="h-4 w-4 shrink-0 text-forest" aria-hidden />
        {o.storeName}
      </p>
      <ButtonLink href={`/orders/${o.id}`} size="lg" className="mt-3 w-full">
        受取チケットを見る
      </ButtonLink>
    </div>
  );
}

function StatLink({
  href,
  label,
  value,
  unit,
  testId,
  Icon,
  accent,
}: {
  href: string;
  label: string;
  value: number;
  unit: string;
  testId: string;
  Icon: typeof Ticket;
  accent?: boolean;
}) {
  return (
    <Link href={href} className="rounded-2xl bg-canvas px-3 py-3 hover:bg-sand">
      <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-2">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </span>
      <span className={cn("tnum mt-1 block text-[24px] font-bold leading-tight", accent && "text-forest")} data-testid={testId}>
        {value.toLocaleString("ja-JP")}
        <span className="ml-0.5 text-[12px] font-semibold">{unit}</span>
      </span>
    </Link>
  );
}
