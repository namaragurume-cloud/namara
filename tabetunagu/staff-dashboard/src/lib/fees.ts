/**
 * 料金プラン（TABETUNAGU 本体の src/lib/fees.ts と同じ計算）。
 * TABETUNAGU は商品代金を預からないため、お店の手取り = 売上 − TABETUNAGU 手数料。
 */
export const PLANS = {
  free: { name: "FREE", monthlyFee: 0, bps: 1500 },
  standard: { name: "STANDARD", monthlyFee: 4980, bps: 500 },
} as const;
export type PlanCode = keyof typeof PLANS;

export function feeFor(plan: PlanCode, gmv: number) {
  const p = PLANS[plan];
  return p.monthlyFee + Math.floor((Math.max(0, Math.round(gmv)) * p.bps) / 10000);
}

export function compareWithStandard(plan: PlanCode, gmv: number) {
  const current = feeFor(plan, gmv);
  const standard = feeFor("standard", gmv);
  const free = feeFor("free", gmv);
  return {
    fee: current,
    takeHome: gmv - current,
    standardTakeHome: gmv - standard,
    /** STANDARD にした場合に増える手取り（マイナスなら FREE のほうがお得） */
    standardGain: free - standard,
  };
}

export const yen = (n: number) => n.toLocaleString("ja-JP");
