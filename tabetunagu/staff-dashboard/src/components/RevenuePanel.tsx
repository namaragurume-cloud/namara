import { compareWithStandard, PLANS, yen, type PlanCode } from "../lib/fees";

/**
 * 今月の売上と手取り＋プランのアップセル。
 * TABETUNAGU は代金を預からないため「振込」ではなく、お店の手取り（売上 − 手数料）を表示する。
 */
export function RevenuePanel({ plan, gmv }: { plan: PlanCode; gmv: number }) {
  const c = compareWithStandard(plan, gmv);
  const p = PLANS[plan];
  return (
    <section aria-label="今月の売上" className="grid gap-2.5 rounded-3xl bg-stone-900 px-4 py-3.5 text-white sm:px-6 sm:py-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[13px] font-bold text-white/70 sm:text-sm">今月の売上総額</p>
          <p className="num text-[28px] font-extrabold leading-tight sm:text-4xl">
            {yen(gmv)}
            <span className="text-base font-bold">円</span>
          </p>
        </div>
        <div>
          <p className="text-[13px] font-bold text-white/70 sm:text-sm">お店の手取り（手数料差引後）</p>
          <p className="num text-[28px] font-extrabold leading-tight text-[#9be3b4] sm:text-4xl">
            {yen(c.takeHome)}
            <span className="text-base font-bold">円</span>
          </p>
        </div>
      </div>
      <p className="text-[12.5px] font-medium text-white/65 sm:text-sm">
        TABETUNAGU 手数料 {yen(c.fee)}円（{p.name}
        {p.monthlyFee ? `：月額${yen(p.monthlyFee)}円＋` : "："}成約売上の{p.bps / 100}%）。代金はお店のレジで受け取り済みです。
      </p>
      {plan === "free" && c.standardGain > 0 && (
        <p className="rounded-2xl bg-[#ffd965] px-3.5 py-2.5 text-[15px] font-black leading-snug text-stone-950 sm:text-lg">
          💡 もしSTANDARDプランなら、今月の手取りは{yen(c.standardTakeHome)}円でした（＋{yen(c.standardGain)}円お得！）
        </p>
      )}
      {plan === "free" && c.standardGain <= 0 && (
        <p className="rounded-2xl bg-white/10 px-3.5 py-2.5 text-[14px] font-bold">いまの売上なら FREE プランがお得です（月の売上が49,800円を超えると STANDARD がお得）</p>
      )}
      {plan === "standard" && (
        <p className="rounded-2xl bg-[#9be3b4] px-3.5 py-2.5 text-[15px] font-black text-stone-950">
          STANDARDプランで、今月は FREE より {yen(Math.max(0, c.standardGain))}円 手取りが多くなっています
        </p>
      )}
    </section>
  );
}
