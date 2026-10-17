/**
 * 料金プランと手数料計算。
 * TABETUNAGU は商品代金を預からない。店舗へは「月額 + 成約売上 × 手数料率」を請求する。
 * 手数料率は basis point（1% = 100）で持ち、浮動小数点の誤差を避ける。円未満は切り捨て。
 */
export type PlanCode = "free" | "standard";

export const PLANS: Record<PlanCode, { code: PlanCode; name: string; monthlyFee: number; commissionBps: number }> = {
  free: { code: "free", name: "FREE", monthlyFee: 0, commissionBps: 1500 },
  standard: { code: "standard", name: "STANDARD", monthlyFee: 4980, commissionBps: 500 },
};

export function isPlanCode(value: string): value is PlanCode {
  return value === "free" || value === "standard";
}

export function rateToBps(rate: number | string) {
  return Math.round(Number(rate) * 10000);
}

export function commissionFor(gmv: number, bps: number) {
  if (!Number.isFinite(gmv) || gmv <= 0) return 0;
  return Math.floor((Math.round(gmv) * bps) / 10000);
}

export type MonthlyFee = {
  plan: PlanCode;
  gmv: number;
  commissionRate: number;
  commission: number;
  monthlyFee: number;
  total: number;
};

/** 1か月分の請求額（プラン固定） */
export function calcMonthlyFee(plan: PlanCode, gmv: number): MonthlyFee {
  const p = PLANS[plan];
  const commission = commissionFor(gmv, p.commissionBps);
  return {
    plan,
    gmv: Math.max(0, Math.round(gmv)),
    commissionRate: p.commissionBps / 10000,
    commission,
    monthlyFee: p.monthlyFee,
    total: p.monthlyFee + commission,
  };
}

/**
 * 月の途中でプランが変わった場合に対応した計算。
 * 成約ごとに記録された手数料率（成約時点のプラン）で手数料を合算し、
 * 月額は月末時点のプランで計上する。
 */
export function calcMonthlyFeeFromCompletions(
  currentPlan: PlanCode,
  completions: { totalPrice: number; commissionRate: number | string | null; planCode?: string | null }[],
): MonthlyFee {
  let gmv = 0;
  let weighted = 0;
  for (const c of completions) {
    const bps =
      c.commissionRate != null
        ? rateToBps(c.commissionRate)
        : PLANS[c.planCode && isPlanCode(c.planCode) ? c.planCode : currentPlan].commissionBps;
    gmv += c.totalPrice;
    weighted += c.totalPrice * bps;
  }
  const commission = Math.floor(weighted / 10000);
  const monthlyFee = PLANS[currentPlan].monthlyFee;
  return {
    plan: currentPlan,
    gmv,
    commissionRate: PLANS[currentPlan].commissionBps / 10000,
    commission,
    monthlyFee,
    total: monthlyFee + commission,
  };
}

/** FREE と STANDARD の損益分岐となる月間成約額（これを超えると STANDARD がお得） */
export const BREAK_EVEN_GMV = Math.ceil(
  (PLANS.standard.monthlyFee * 10000) / (PLANS.free.commissionBps - PLANS.standard.commissionBps),
);
