import { BREAK_EVEN_GMV, calcMonthlyFee, PLANS, type PlanCode } from "./fees";
import { STANDARD_NEAR_RATIO } from "./poc-dashboard";
import { jstDateTime, pickupWindow } from "./time";

/**
 * 店舗ダッシュボード・出品の表示ルール（画面から切り離してテストできるよう純粋関数だけ）。
 * 料金・損益分岐は lib/fees（PRICING）から計算し、金額を画面に直接書かない。
 */

// ---------------------------------------------------------------------------
// 商品の状態（内部の status 名は出さない）
// ---------------------------------------------------------------------------

export type ProductStateLabel = "公開中" | "売り切れ" | "受付終了" | "下書き" | "非公開";

/** 店舗向けの商品の状態。受取終了を過ぎた商品は、状態の更新前でも「受付終了」 */
export function productStateLabel(status: string, pickupEndAt: string | undefined, now: number): ProductStateLabel {
  if (status !== "deleted" && pickupEndAt !== undefined && Date.parse(pickupEndAt) <= now) return "受付終了";
  if (status === "published") return "公開中";
  if (status === "sold_out") return "売り切れ";
  if (status === "draft") return "下書き";
  return "非公開";
}

// ---------------------------------------------------------------------------
// プラン・損益分岐
// ---------------------------------------------------------------------------

export function planView(plan: PlanCode) {
  const p = PLANS[plan];
  return { code: plan, name: p.name, monthlyFee: p.monthlyFee, commissionPercent: p.commissionBps / 100 };
}

/** 店舗受取見込 = 売上 − 成約手数料（Stripe の入金タイミングとは異なる場合がある） */
export function storeNetEstimate(sales: number, commission: number) {
  return Math.max(0, sales - commission);
}

export type StandardHint =
  | { kind: "near"; sales: number; gap: number; breakEven: number }
  | { kind: "over"; sales: number; breakEven: number; freeFee: number; standardFee: number };

/**
 * STANDARD の案内（押し売りしない）。FREE 店舗で、今月の売上が損益分岐に近い（70%以上）か超えたときだけ返す。
 * 損益分岐は FREE 20% と STANDARD 月額 + 8% が等しくなる売上（lib/fees の BREAK_EVEN_GMV）。
 */
export function standardHint(plan: PlanCode, monthSales: number, breakEven: number = BREAK_EVEN_GMV): StandardHint | null {
  if (plan !== "free" || !Number.isFinite(monthSales) || monthSales < breakEven * STANDARD_NEAR_RATIO) return null;
  if (monthSales < breakEven) return { kind: "near", sales: monthSales, gap: breakEven - monthSales, breakEven };
  return {
    kind: "over",
    sales: monthSales,
    breakEven,
    freeFee: calcMonthlyFee("free", monthSales).total,
    standardFee: calcMonthlyFee("standard", monthSales).total,
  };
}

// ---------------------------------------------------------------------------
// 導入準備・アラート
// ---------------------------------------------------------------------------

export function readinessProgress(items: { ok: boolean }[]) {
  const done = items.filter((i) => i.ok).length;
  const total = items.length;
  const left = total - done;
  return { done, total, left, text: left === 0 ? "公開準備が完了しています" : `あと${left}項目で公開準備完了` };
}

export type StoreAlert = { key: string; text: string; href: string; tone: "action" | "info"; ownerOnly?: boolean };

/** 店舗ダッシュボードのお知らせ（本当に必要なものだけ。管理者向けの技術的な警告は出さない） */
export function storeAlerts(i: {
  stripeReady: boolean;
  upcomingPickups: number;
  unclaimedYesterday: number;
  productCount: number;
  liveCount: number;
  isOwner: boolean;
}): StoreAlert[] {
  const list: StoreAlert[] = [];
  if (!i.stripeReady) {
    list.push(
      i.isOwner
        ? { key: "stripe", text: "売上受取設定を完了してください", href: "/store/payouts", tone: "action", ownerOnly: true }
        : { key: "stripe", text: "売上受取設定が未完了です（店舗オーナーが設定します）", href: "/store/help", tone: "info" },
    );
  }
  if (i.productCount === 0) list.push({ key: "no_products", text: "まだ商品がありません", href: "/store/products/new", tone: "action" });
  else if (i.liveCount === 0) list.push({ key: "no_live", text: "公開中の商品がありません", href: "/store/products/new", tone: "info" });
  if (i.upcomingPickups > 0) list.push({ key: "pickups", text: `これから${i.upcomingPickups}件受取予定`, href: "/store/monitor", tone: "info" });
  if (i.unclaimedYesterday > 0) list.push({ key: "unclaimed", text: `昨日の未受取 ${i.unclaimedYesterday}件`, href: "/store/orders", tone: "info" });
  return list;
}

// ---------------------------------------------------------------------------
// 売上の期間
// ---------------------------------------------------------------------------

export type SalesPeriod = "today" | "7d" | "month";

export const SALES_PERIODS: { id: SalesPeriod; label: string }[] = [
  { id: "today", label: "今日" },
  { id: "7d", label: "7日" },
  { id: "month", label: "今月" },
];

export function parseSalesPeriod(raw: string | undefined): SalesPeriod {
  return raw === "today" || raw === "7d" ? raw : "month";
}

/** 期間（JST）。今日 = 当日0:00〜、7日 = 当日を含む直近7日、今月 = 月初〜 */
export function salesRange(period: SalesPeriod, now: Date) {
  const today = new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
  const end = new Date(jstDateTime(today, "00:00").getTime() + 86_400_000);
  if (period === "today") return { start: jstDateTime(today, "00:00"), end };
  if (period === "7d") return { start: new Date(end.getTime() - 7 * 86_400_000), end };
  return { start: jstDateTime(`${today.slice(0, 7)}-01`, "00:00"), end };
}

// ---------------------------------------------------------------------------
// 出品
// ---------------------------------------------------------------------------

/**
 * 受取時間のプレビュー。日付つきで判定し、終了が開始以前なら翌日（例: 10/23 23:30〜10/24 01:30）。
 * 商品の日時は実日時で保存する（店舗モニターの営業日 03:00 切替とは別）。
 */
export function pickupPreview(date: string, start: string, end: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const w = pickupWindow(date, start, end);
  const md = (d: Date) => {
    const j = new Date(d.getTime() + 9 * 3_600_000);
    return `${j.getUTCMonth() + 1}/${j.getUTCDate()}`;
  };
  const overnight = md(w.start) !== md(w.end);
  return {
    start: w.start,
    end: w.end,
    overnight,
    label: overnight ? `${md(w.start)} ${start}〜${md(w.end)} ${end}` : `${md(w.start)} ${start}〜${end}`,
    minutes: Math.round((w.end.getTime() - w.start.getTime()) / 60_000),
  };
}

/**
 * 既存の商品を複製して出品するときの初期値。商品名・画像・価格・参考価格・説明・BOX・カテゴリーは引き継ぎ、
 * 数量と受取時間は必ず確認・再設定してもらう（過去の在庫や日時をそのまま公開しない）。
 */
export function duplicateDefaults(p: {
  name: string;
  description: string;
  category: string;
  isBox: boolean;
  originalPrice: number;
  rescuePrice: number;
  imageUrl: string | null;
}) {
  return {
    name: p.name,
    description: p.description,
    category: p.category,
    isBox: p.isBox,
    originalPrice: p.originalPrice,
    rescuePrice: p.rescuePrice,
    imageUrl: p.imageUrl ?? "",
    quantity: "" as const,
    pickupStart: "",
    pickupEnd: "",
    templateId: "",
  };
}
