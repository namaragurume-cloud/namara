import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LogoMark } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { brand } from "@/lib/brand";
import { grams, hhmm } from "@/lib/format";
import { requireViewer } from "@/server/auth/viewer";
import { getCompletedGroup, getMyReservation, getMyStats } from "@/server/services/reservations";

export const metadata: Metadata = { title: brand.completed };

export default async function DonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireViewer(`/done/${id}`);
  const group = await getCompletedGroup(viewer.id, id);
  if (!group) {
    if (await getMyReservation(viewer.id, id)) redirect(`/reservations/${id}`);
    notFound();
  }
  const stats = await getMyStats(viewer.id);
  const first = group.reservations[0];
  const total = group.reservations.reduce((s, r) => s + r.totalPrice, 0);
  const savedNow = group.reservations.reduce((s, r) => s + r.estimatedWeightG * r.quantity, 0);

  return (
    <div className="space-y-6 pt-4 text-center">
      <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
        <span className="anim-ring absolute inset-0 rounded-full bg-leaf-soft" aria-hidden />
        <LogoMark className="anim-baton relative h-14 w-14 text-forest" />
      </div>
      <div>
        <h1 className="text-[30px] font-bold tracking-wide">{brand.completed}！</h1>
        <p className="mt-2 text-[13px] text-muted">
          {first.storeName}・{hhmm(first.completedAt!)} {brand.philosophy}
        </p>
      </div>

      <div className="rounded-3xl bg-forest px-5 py-5 text-left text-white">
        <p className="text-[12px] text-white/70">この画面をスタッフにお見せのうえ、レジでお支払いください</p>
        <ul className="mt-3 space-y-2">
          {group.reservations.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[15px] font-bold">
                {r.productName}
                <span className="ml-1 text-[12px] font-semibold text-white/70">
                  ×{r.quantity}
                </span>
              </span>
              <span className="tnum shrink-0 text-[13px] tracking-wider text-white/80">{r.code}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-baseline justify-between border-t border-white/15 pt-3">
          <span className="text-[12px] text-white/70">お支払い（お店で）</span>
          <span className="tnum text-[24px] font-semibold">
            {total.toLocaleString("ja-JP")}
            <span className="text-[12px]">円</span>
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-canvas px-2 py-3.5">
          <dt className="text-[11px] text-muted">獲得ポイント</dt>
          <dd className="tnum mt-1 text-[20px] font-semibold text-forest">+{group.points}</dd>
        </div>
        <div className="rounded-2xl bg-canvas px-2 py-3.5">
          <dt className="text-[11px] text-muted">累計食べつなぎ</dt>
          <dd className="tnum mt-1 text-[20px] font-semibold">
            {stats.completedCount}
            <span className="text-[11px]">回</span>
          </dd>
        </div>
        <div className="rounded-2xl bg-canvas px-2 py-3.5">
          <dt className="text-[11px] text-muted">推定食品ロス削減</dt>
          <dd className="tnum mt-1 text-[20px] font-semibold">{grams(stats.foodSavedG)}</dd>
        </div>
      </dl>
      <p className="text-[11.5px] leading-relaxed text-muted">
        今回は約{grams(savedNow)}のおいしさを次へつなぎました。削減量はカテゴリーごとの目安重量から計算しています。
      </p>

      <div className="flex gap-2">
        <ButtonLink href="/" variant="secondary" className="flex-1">
          ホームへ
        </ButtonLink>
        <ButtonLink href="/reservations?tab=past" variant="dark" className="flex-1">
          履歴を見る
        </ButtonLink>
      </div>
    </div>
  );
}
