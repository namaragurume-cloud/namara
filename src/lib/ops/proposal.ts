import { creatorIconUrl, creatorProfileUrl } from "./creator-profile";
import { microPlan } from "@/data/pricing";
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

/** マイクロインフルエンサーの定額プラン（ホームページの料金表と同じ。src/data/pricing.ts・税別） */
export const MICRO_FOLLOWERS = 10000;
export const microOptions = microPlan.options.map((o) => ({ people: o.people, amount: o.price * 10000, recommended: Boolean("recommended" in o && o.recommended) }));
export const microOption = (people?: number) => microOptions.find((o) => o.people === people);
/** フォロワー1万人未満（フォロワー数が未登録の人は含めない） */
export const isMicro = (c: Pick<Creator, "followers">) => c.followers !== undefined && c.followers < MICRO_FOLLOWERS;

/** マイクロ発信者1人あたりの予想リーチ（フォロワー1万人未満で推計できた人の中央値。3人以上いるときだけ） */
export function microReachPerPerson(creators: Creator[], reach?: Map<string, ReachEstimate>): Pick<ReachEstimate, "value" | "low" | "high"> | undefined {
  const est = creators.filter((c) => c.followers !== undefined && c.followers < MICRO_FOLLOWERS).map((c) => reach?.get(c.id)).filter((e): e is ReachEstimate => Boolean(e));
  if (est.length < 3) return undefined;
  const med = (k: "value" | "low" | "high") => {
    const v = est.map((e) => e[k]).sort((a, b) => a - b);
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };
  return { value: med("value"), low: med("low"), high: med("high") };
}

export type PlanLine = {
  label: string;
  sub?: string;
  amount: number;
  creator?: { name: string; url?: string; icon?: string };
  reach?: ReachEstimate;
  /** マイクロインフルエンサーのまとめ行 */
  micro?: { people: number; reach?: Pick<ReachEstimate, "value" | "low" | "high"> };
};
export type Plan = {
  creators: Creator[];
  lines: PlanLine[];
  subtotal: number;
  tax: number;
  total: number;
  /** 料金が未設定の発信者 */
  missingPrice: Creator[];
  followers: number;
  /** マイクロインフルエンサーの人数（定額プラン） */
  microPeople: number;
  /** 予想リーチの合計（推計できた発信者の分だけ） */
  reach?: { value: number; low: number; high: number; covered: number; missing: Creator[]; fromFollowers: number; missingMicro: boolean; partial: boolean };
  /** 1リーチあたりの料金（税別の小計 ÷ 予想リーチ） */
  costPerReach?: number;
};

export function buildPlan(
  creators: Creator[],
  s: ProposalSettings,
  reach?: Map<string, ReachEstimate>,
  micro?: { people?: number; perPerson?: Pick<ReachEstimate, "value" | "low" | "high"> },
): Plan {
  const mo = microOption(micro?.people);
  const microReach = mo && micro?.perPerson ? { value: Math.round(micro.perPerson.value * mo.people), low: Math.round(micro.perPerson.low * mo.people), high: Math.round(micro.perPerson.high * mo.people) } : undefined;
  const lines: PlanLine[] = creators.map((c) => ({
    label: `${c.name}${c.account ? `（@${c.account}）` : ""}`,
    sub: `${c.platform}${c.followers ? `・フォロワー ${c.followers.toLocaleString("ja-JP")}` : ""}`,
    amount: c.price ?? 0,
    creator: { name: c.name, url: creatorProfileUrl(c), icon: creatorIconUrl(c) },
    reach: reach?.get(c.id),
  }));
  if (mo) {
    lines.unshift({
      label: `マイクロインフルエンサー ${mo.people}名調整`,
      sub: `フォロワー1万人未満の発信者${mo.people}名（発信者はこちらで調整します）`,
      amount: mo.amount,
      micro: { people: mo.people, reach: microReach },
    });
  }
  const est = [...creators.map((c) => reach?.get(c.id)).filter((e): e is ReachEstimate => Boolean(e)), ...(microReach ? [microReach] : [])];
  const sum = (k: "value" | "low" | "high") => est.reduce((n, e) => n + e[k], 0);
  const reachTotal = reach && est.length
    ? {
        value: sum("value"),
        low: sum("low"),
        high: sum("high"),
        covered: est.length,
        missing: creators.filter((c) => !reach.get(c.id)),
        fromFollowers: creators.filter((c) => reach.get(c.id)?.basis === "followers").length,
        missingMicro: Boolean(mo && !microReach),
        partial: creators.some((c) => !reach.get(c.id)) || Boolean(mo && !microReach),
      }
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
    microPeople: mo?.people ?? 0,
    reach: reachTotal,
    // 一部しか推計できていないときは、単価が実際より安く見えてしまうので出さない
    costPerReach: reachTotal && !reachTotal.partial && reachTotal.value > 0 ? subtotal / reachTotal.value : undefined,
  };
}

export const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;
