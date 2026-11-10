import { creatorIconUrl, creatorProfileUrl } from "./creator-profile";
import type { ReachEstimate } from "./reach";
import type { Creator, ProposalSettings } from "./types";

/** 提案の料金計算（AIは使わず、設定した料金から計算する） */

export const DEFAULT_PROPOSAL_SETTINGS: ProposalSettings = {
  id: "proposal",
  taxRate: 10,
  directionFee: 0,
  directionFeeLabel: "ディレクション費",
  validDays: 14,
  notes: "撮影時の飲食代は別途ご相談となります。投稿の二次利用（広告利用など）は別途お見積りいたします。",
  showReach: true,
};

export type PlanLine = { label: string; sub?: string; amount: number; creator?: { name: string; url?: string; icon?: string }; reach?: ReachEstimate };
export type Plan = {
  creators: Creator[];
  lines: PlanLine[];
  subtotal: number;
  tax: number;
  total: number;
  /** 料金が未設定の発信者 */
  missingPrice: Creator[];
  followers: number;
  /** 予想リーチの合計（推計できた発信者の分だけ） */
  reach?: { value: number; low: number; high: number; covered: number; missing: Creator[]; fromFollowers: number };
  /** 1リーチあたりの料金（税別の小計 ÷ 予想リーチ） */
  costPerReach?: number;
};

export function buildPlan(creators: Creator[], s: ProposalSettings, reach?: Map<string, ReachEstimate>): Plan {
  const lines: PlanLine[] = creators.map((c) => ({
    label: `${c.name}${c.account ? `（@${c.account}）` : ""}`,
    sub: `${c.platform}${c.followers ? `・フォロワー ${c.followers.toLocaleString("ja-JP")}` : ""}`,
    amount: c.price ?? 0,
    creator: { name: c.name, url: creatorProfileUrl(c), icon: creatorIconUrl(c) },
    reach: reach?.get(c.id),
  }));
  const est = creators.map((c) => reach?.get(c.id)).filter((e): e is ReachEstimate => Boolean(e));
  const sum = (k: "value" | "low" | "high") => est.reduce((n, e) => n + e[k], 0);
  const reachTotal = reach && est.length
    ? { value: sum("value"), low: sum("low"), high: sum("high"), covered: est.length, missing: creators.filter((c) => !reach.get(c.id)), fromFollowers: est.filter((e) => e.basis === "followers").length }
    : undefined;
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
    reach: reachTotal,
    costPerReach: reachTotal && reachTotal.value > 0 ? subtotal / reachTotal.value : undefined,
  };
}

export const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
