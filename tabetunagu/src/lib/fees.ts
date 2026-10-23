/**
 * 料金・手数料・決済原価の一元管理。
 *
 * - 金額はすべて整数の円、率は basis point（1% = 100）で持ち、浮動小数点の誤差を避ける。円未満は切り捨て。
 * - 成約手数料・月額はいずれも決済手数料込み（決済原価は TABETUNAGU が負担する）。
 * - つなぐチャージはユーザーが1注文ごとに支払うシステム利用料。成約手数料の計算対象には含めず、
 *   TABETUNAGU の独立した売上として扱う。
 *
 * DB 側の値（public.plans / public.platform_settings）はマイグレーションで同じ値を入れている。
 * 値を変えるときは両方を変更すること（tests/pricing-sync.test.ts が不一致を検出する）。
 */
export type PlanCode = "free" | "standard";

export type PlanPricing = { code: PlanCode; name: string; monthlyFee: number; commissionBps: number };

/** 決済原価の想定（率は basis point、固定額は円） */
export type PaymentFeeAssumption = { provider: string; percentBps: number; fixedYen: number };

export const PRICING = {
  plans: {
    free: { code: "free", name: "FREE", monthlyFee: 0, commissionBps: 2000 },
    standard: { code: "standard", name: "STANDARD", monthlyFee: 4980, commissionBps: 800 },
  } satisfies Record<PlanCode, PlanPricing>,
  /** つなぐチャージ（1注文あたり・円） */
  tsunaguCharge: 30,
  /** 決済成功時に付与する つなぐポイント（1注文あたり） */
  orderPoints: 30,
  /**
   * 決済原価の想定（売上見込み・採算の試算にのみ使う。請求や返金の計算には使わない）。
   * 実際の手数料は決済事業者の契約・決済手段によって変わるため、ここだけを変更する。
   */
  paymentFeeAssumption: { provider: "stripe", percentBps: 360, fixedYen: 0 },
} as const;

export const PLANS: Record<PlanCode, PlanPricing> = PRICING.plans;

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

export type OrderAmounts = {
  /** 商品小計（成約手数料の計算対象） */
  subtotal: number;
  tsunaguCharge: number;
  /** ユーザーの支払総額 = 小計 + つなぐチャージ */
  total: number;
  commissionBps: number;
  commissionAmount: number;
  /** TABETUNAGU の売上 = 成約手数料 + つなぐチャージ */
  platformFeeTotal: number;
  /** 店舗の受取額 = 小計 − 成約手数料 */
  storeNet: number;
};

/**
 * 1注文の金額内訳。DB 関数 public.create_order と同じ計算（円未満切り捨て）。
 * 表示用。注文の金額は必ずサーバー（DB）で確定させ、この結果を信用して保存しない。
 */
export function calcOrderAmounts(
  lines: { unitPrice: number; quantity: number }[],
  commissionBps: number,
  tsunaguCharge: number = PRICING.tsunaguCharge,
): OrderAmounts {
  const subtotal = lines.reduce((sum, l) => sum + Math.round(l.unitPrice) * Math.round(l.quantity), 0);
  const commissionAmount = commissionFor(subtotal, commissionBps);
  return {
    subtotal,
    tsunaguCharge,
    total: subtotal + tsunaguCharge,
    commissionBps,
    commissionAmount,
    platformFeeTotal: commissionAmount + tsunaguCharge,
    storeNet: subtotal - commissionAmount,
  };
}

/** 決済原価の見込み（想定値ベース。円未満切り上げで保守的に見積もる） */
export function estimatePaymentFee(amount: number, assumption: PaymentFeeAssumption = PRICING.paymentFeeAssumption) {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.ceil((Math.round(amount) * assumption.percentBps) / 10000) + assumption.fixedYen;
}
