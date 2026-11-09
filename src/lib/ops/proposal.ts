import type { Creator, ProposalSettings } from "./types";

/** 提案の料金計算（AIは使わず、設定した料金から計算する） */

export const DEFAULT_PROPOSAL_SETTINGS: ProposalSettings = {
  id: "proposal",
  taxRate: 10,
  directionFee: 0,
  directionFeeLabel: "ディレクション費",
  validDays: 14,
  notes: "撮影時の飲食代は別途ご相談となります。投稿の二次利用（広告利用など）は別途お見積りいたします。",
};

export type PlanLine = { label: string; sub?: string; amount: number };
export type Plan = {
  creators: Creator[];
  lines: PlanLine[];
  subtotal: number;
  tax: number;
  total: number;
  /** 料金が未設定の発信者 */
  missingPrice: Creator[];
  followers: number;
};

export function buildPlan(creators: Creator[], s: ProposalSettings): Plan {
  const lines: PlanLine[] = creators.map((c) => ({
    label: `${c.name}${c.account ? `（@${c.account}）` : ""}`,
    sub: `${c.platform}${c.followers ? `・フォロワー ${c.followers.toLocaleString("ja-JP")}` : ""}`,
    amount: c.price ?? 0,
  }));
  if (s.directionFee > 0) lines.push({ label: s.directionFeeLabel || "ディレクション費", amount: s.directionFee });
  const subtotal = lines.reduce((n, l) => n + l.amount, 0);
  const tax = Math.floor((subtotal * s.taxRate) / 100);
  return {
    creators,
    lines,
    subtotal,
    tax,
    total: subtotal + tax,
    missingPrice: creators.filter((c) => !c.price),
    followers: creators.reduce((n, c) => n + (c.followers ?? 0), 0),
  };
}

export const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
