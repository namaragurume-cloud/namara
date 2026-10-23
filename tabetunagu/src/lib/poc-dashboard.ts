import { BREAK_EVEN_GMV, calcMonthlyFee } from "./fees";

/**
 * 管理ダッシュボード（PoC 運営の判断用）の表示ルール。DB に新しい状態は持たず、既存の集計値から算出する。
 * 画面から切り離してテストできるよう、ここは純粋関数だけ。
 */

// ---------------------------------------------------------------------------
// PoC の目標（ここ以外に目標値を書かない）
// ---------------------------------------------------------------------------

export type PocKpiKey = "tsunagiRate" | "repeatRate" | "storeWau" | "swipeRate" | "standardCandidates";

export const POC_TARGETS = {
  /** 食べつなぎ率（売れた数量 ÷ 出品数量） */
  tsunagiRate: { target: 0.8, minSample: 20, unit: "件", label: "食べつなぎ率" },
  /** 30日リピート率（初回購入から30日以内に2回目） */
  repeatRate: { target: 0.4, minSample: 20, unit: "人", label: "30日リピート率" },
  /** 店舗 WAU（直近7日に出品した稼働店舗 ÷ 稼働店舗） */
  storeWau: { target: 0.7, minSample: 5, unit: "店舗", label: "店舗WAU" },
  /** 自己スワイプ完了率（受取期限が来た決済済み注文のうち受取完了） */
  swipeRate: { target: 0.95, minSample: 20, unit: "件", label: "自己スワイプ完了率" },
  /** STANDARD 候補店舗数（Month3 で6店舗程度が目安） */
  standardCandidates: { target: 6, minSample: 0, unit: "店舗", label: "STANDARD候補" },
} as const satisfies Record<PocKpiKey, { target: number; minSample: number; unit: string; label: string }>;

/** 目標の 90% 以上なら「あと少し」 */
export const NEAR_TARGET_RATIO = 0.9;

export type KpiState = "achieved" | "near" | "missed" | "insufficient";

export const KPI_STATE_LABEL: Record<KpiState, string> = {
  achieved: "達成",
  near: "あと少し",
  missed: "未達",
  insufficient: "データ不足",
};

/**
 * KPI の評価。母数が minSample 未満なら成功・失敗を判定せず「データ不足」。
 */
export function kpiState(value: number | null, target: number, denominator: number, minSample: number): KpiState {
  if (value === null || !Number.isFinite(value) || denominator < Math.max(1, minSample)) return "insufficient";
  if (value >= target) return "achieved";
  if (value >= target * NEAR_TARGET_RATIO) return "near";
  return "missed";
}

export type PocKpi = {
  key: PocKpiKey;
  label: string;
  /** 割合（0〜1）または件数 */
  value: number | null;
  kind: "rate" | "count";
  numerator: number;
  denominator: number;
  unit: string;
  target: number;
  state: KpiState;
  /** 定義（期間フィルターの影響を受けるかを含む） */
  note: string;
};

export type PocKpiInput = {
  tsunagi: { sold: number; listed: number };
  repeat: { repeated: number; cohort: number };
  storeWau: { active7d: number; activeStores: number };
  swipe: { done: number; due: number };
  standardCandidates: number;
};

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export function pocKpis(i: PocKpiInput): PocKpi[] {
  const T = POC_TARGETS;
  const rate = (key: Exclude<PocKpiKey, "standardCandidates">, num: number, den: number, note: string): PocKpi => {
    const value = ratio(num, den);
    return {
      key,
      label: T[key].label,
      value,
      kind: "rate",
      numerator: num,
      denominator: den,
      unit: T[key].unit,
      target: T[key].target,
      state: kpiState(value, T[key].target, den, T[key].minSample),
      note,
    };
  };
  const sc = i.standardCandidates;
  return [
    rate("tsunagiRate", i.tsunagi.sold, i.tsunagi.listed, "期間内に受取開始の出品の、売れた数量 ÷ 出品数量"),
    rate("repeatRate", i.repeat.repeated, i.repeat.cohort, "初回購入から30日以上のユーザーのうち、30日以内に2回目（期間切替の影響なし）"),
    rate("storeWau", i.storeWau.active7d, i.storeWau.activeStores, "直近7日に出品した稼働店舗 ÷ 稼働店舗（期間切替の影響なし）"),
    rate("swipeRate", i.swipe.done, i.swipe.due, "受取期限が来た決済済み注文のうち、お客様のスワイプで受取完了"),
    {
      key: "standardCandidates",
      label: T.standardCandidates.label,
      value: sc,
      kind: "count",
      numerator: sc,
      denominator: sc,
      unit: T.standardCandidates.unit,
      target: T.standardCandidates.target,
      // 店舗数そのものが指標のため母数の不足はない。Month3 の目安に対する進捗
      state: sc >= T.standardCandidates.target ? "achieved" : sc >= T.standardCandidates.target * NEAR_TARGET_RATIO ? "near" : "missed",
      note: "FREE 店舗のうち、直近30日の売上が損益分岐以上（Month3 で6店舗程度が目安）",
    },
  ];
}

// ---------------------------------------------------------------------------
// 重要度
// ---------------------------------------------------------------------------

export type Severity = "ok" | "warning" | "critical";

export const SEVERITY_LABEL: Record<Severity, string> = { ok: "正常", warning: "注意", critical: "対応必要" };

/** 未受取率 = 未受取 ÷（受取完了 + 未受取）。決済待ち・返金・キャンセル・受取前の注文は分母に入れない */
export function unclaimedRate(pickedUp: number, unclaimed: number): number | null {
  return ratio(unclaimed, pickedUp + unclaimed);
}

/** 未受取率がこれ以上の店舗を「未受取率が高い」とする（受取結果が一定数以上ある店舗のみ） */
export const HIGH_UNCLAIMED_RATE = 0.2;
export const MIN_RESULTS_FOR_UNCLAIMED_FLAG = 5;

export function isHighUnclaimed(pickedUp: number, unclaimed: number) {
  const r = unclaimedRate(pickedUp, unclaimed);
  return r !== null && pickedUp + unclaimed >= MIN_RESULTS_FOR_UNCLAIMED_FLAG && r >= HIGH_UNCLAIMED_RATE;
}

// ---------------------------------------------------------------------------
// 定期処理（Cron）
// ---------------------------------------------------------------------------

/** これ以上前なら「注意」（5分ごとの実行が2回続けて抜けている）。15分以上は既存の基準どおり異常 */
export const CRON_NOTICE_MINUTES = 10;

export function cronHealth(cron: { state: "ok" | "stale" | "never"; minutesAgo: number | null }, staleMinutes: number) {
  if (cron.state === "never" || cron.minutesAgo === null) {
    return { severity: "critical" as Severity, text: "まだ一度も成功していません" };
  }
  if (cron.state === "stale" || cron.minutesAgo >= staleMinutes) {
    return { severity: "critical" as Severity, text: `${staleMinutes}分以上更新されていません（最終成功 ${cron.minutesAgo}分前）` };
  }
  if (cron.minutesAgo >= CRON_NOTICE_MINUTES) return { severity: "warning" as Severity, text: `最終成功 ${cron.minutesAgo}分前` };
  return { severity: "ok" as Severity, text: `最終成功 ${cron.minutesAgo}分前` };
}

// ---------------------------------------------------------------------------
// 機能フラグ（秘密の値は扱わない。設定名だけ）
// ---------------------------------------------------------------------------

export const SETTING_LABEL: Record<string, string> = {
  STRIPE_SECRET_KEY: "Stripe 秘密鍵が未設定",
  STRIPE_WEBHOOK_SECRET: "Stripe Webhook Secret が未設定",
  STRIPE_CHECKOUT_RETURN_URL: "Checkout の戻り先 URL（https）が未設定",
  CRON_SECRET: "CRON_SECRET が未設定（16文字以上）",
};

export type FlagView = { state: "on" | "off" | "forced_off"; label: string; reasons: string[] };

export function flagView(f: { requested: boolean; effective: boolean; enforced: boolean; missing: readonly string[] }): FlagView {
  if (f.effective) return { state: "on", label: f.enforced ? "ON（本番で有効）" : "ON", reasons: [] };
  if (f.requested) {
    return { state: "forced_off", label: "ON 指定・設定不足のため OFF", reasons: f.missing.map((k) => SETTING_LABEL[k] ?? `${k} が未設定`) };
  }
  return { state: "off", label: "OFF（旧導線）", reasons: [] };
}

// ---------------------------------------------------------------------------
// 要対応アラート・PoC ステータス
// ---------------------------------------------------------------------------

export type Alert = { key: string; label: string; count: number | null; severity: Severity; href?: string; note?: string };

export type AlertInput = {
  requiresReview: number;
  refundsFailed: number;
  cron: { severity: Severity; text: string };
  maintenanceBacklog: number;
  storesConnectPending: number;
  highUnclaimedStores: number;
  flag: FlagView;
};

/**
 * 要対応の一覧（問題があるものだけを返す）。Stripe の紛争・早期不正警告はまだ取り込んでいないため、
 * 0件とは表示しない（画面で「Stripe ダッシュボードで確認」と案内する）。
 */
export function buildAlerts(i: AlertInput): Alert[] {
  const list: Alert[] = [
    { key: "requires_review", label: "要確認の決済（requires_review）", count: i.requiresReview, severity: i.requiresReview > 0 ? "critical" : "ok", href: "/admin/review" },
    { key: "refund_failed", label: "失敗した返金", count: i.refundsFailed, severity: i.refundsFailed > 0 ? "critical" : "ok", href: "/admin/review" },
    { key: "cron", label: "定期処理（Cron）", count: null, severity: i.cron.severity, note: i.cron.text },
    {
      key: "backlog",
      label: "期限を過ぎても処理されていない注文",
      count: i.maintenanceBacklog,
      severity: i.maintenanceBacklog > 0 ? "critical" : "ok",
    },
    { key: "flag", label: "ENABLE_V2_CHECKOUT が設定不足で OFF", count: null, severity: i.flag.state === "forced_off" ? "critical" : "ok", note: i.flag.reasons.join("、") },
    {
      key: "connect",
      label: "Stripe 未設定の稼働店舗",
      count: i.storesConnectPending,
      severity: i.storesConnectPending > 0 ? "warning" : "ok",
      href: "/admin/stores",
    },
    {
      key: "unclaimed",
      label: "未受取率が高い店舗",
      count: i.highUnclaimedStores,
      severity: i.highUnclaimedStores > 0 ? "warning" : "ok",
      href: "/admin/unclaimed",
    },
  ];
  const order: Record<Severity, number> = { critical: 0, warning: 1, ok: 2 };
  return list.filter((a) => a.severity !== "ok").sort((a, b) => order[a.severity] - order[b.severity]);
}

export type PocStatus = { key: "action" | "running" | "preparing"; label: string; severity: Severity; note: string };

/**
 * PoC ステータス（表示用）。対応必要のアラートがあれば「要対応」、v2 が有効なら「運用中」、それ以外は「公開準備中」。
 * Stripe テストモード疎通・LINE 実機確認・法務確認はシステムで判定できないため、「Go」とは表示しない。
 */
export function pocStatus(alerts: Alert[], flag: FlagView): PocStatus {
  const critical = alerts.filter((a) => a.severity === "critical").length;
  if (critical > 0) return { key: "action", label: "要対応", severity: "critical", note: `対応が必要な項目が${critical}件あります。` };
  if (flag.state === "on") return { key: "running", label: "運用中", severity: "ok", note: "事前決済（v2）の購入導線が有効です。" };
  return { key: "preparing", label: "公開準備中", severity: "warning", note: "事前決済（v2）の購入導線は OFF です。" };
}

/** PoC 判定の参考表示（最終判断は人間。システムは「Go」と断定しない） */
export function goNoGoSummary(kpis: PocKpi[], alerts: Alert[]) {
  const evaluable = kpis.filter((k) => k.state !== "insufficient");
  return {
    achieved: kpis.filter((k) => k.state === "achieved").length,
    total: kpis.length,
    insufficient: kpis.length - evaluable.length,
    actionRequired: alerts.filter((a) => a.severity === "critical").length,
    /** 手動確認の項目（Stripe テストモード疎通・LINE 実機・法務）は画面で判定できないため常に「公開準備未完了」 */
    verdict: "公開準備未完了（最終判断は運営が行います）",
  };
}

// ---------------------------------------------------------------------------
// STANDARD 候補
// ---------------------------------------------------------------------------

/** 損益分岐のこの割合以上の FREE 店舗を「近づいている」とする */
export const STANDARD_NEAR_RATIO = 0.7;
export const STANDARD_LIST_LIMIT = 10;

export type StandardCandidate = {
  id: string;
  name: string;
  sales: number;
  /** 損益分岐まであと（超えていれば 0） */
  gap: number;
  over: boolean;
  /** 同じ売上での月間の手数料負担（試算。FREE: 手数料のみ / STANDARD: 月額 + 手数料） */
  freeFee: number;
  standardFee: number;
};

/**
 * FREE 店舗の STANDARD 候補。並び順: 損益分岐を超えた店舗（売上の高い順）→ 損益分岐に近い店舗（残りの少ない順）。最大10店舗。
 * 損益分岐は lib/fees の BREAK_EVEN_GMV（FREE 20% と STANDARD 月額 + 8% から算出）。
 */
export function standardCandidates(
  stores: { id: string; name: string; plan: string; sales: number }[],
  breakEven: number = BREAK_EVEN_GMV,
): StandardCandidate[] {
  return stores
    .filter((s) => s.plan === "free" && s.sales >= breakEven * STANDARD_NEAR_RATIO)
    .map((s) => ({
      id: s.id,
      name: s.name,
      sales: s.sales,
      gap: Math.max(0, breakEven - s.sales),
      over: s.sales >= breakEven,
      freeFee: calcMonthlyFee("free", s.sales).total,
      standardFee: calcMonthlyFee("standard", s.sales).total,
    }))
    .sort((a, b) => Number(b.over) - Number(a.over) || (a.over ? b.sales - a.sales : a.gap - b.gap || b.sales - a.sales))
    .slice(0, STANDARD_LIST_LIMIT);
}

// ---------------------------------------------------------------------------
// 期間
// ---------------------------------------------------------------------------

export type DashboardPeriod = "today" | "7d" | "30d" | "all";

export const DASHBOARD_PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: "today", label: "今日" },
  { id: "7d", label: "7日" },
  { id: "30d", label: "30日" },
  { id: "all", label: "PoC累計" },
];

export function parseDashboardPeriod(raw: string | undefined): DashboardPeriod {
  return raw === "today" || raw === "7d" || raw === "all" ? raw : "30d";
}

const DAY = 86_400_000;

/** 期間（JST）。今日 = JST の当日 0:00 から。7日・30日 = 当日を含む直近 N 日。PoC累計 = 最初から */
export function dashboardRange(period: DashboardPeriod, now: Date) {
  const jstMidnight = new Date(`${new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)}T00:00:00+09:00`);
  const to = new Date(jstMidnight.getTime() + DAY);
  const days = period === "today" ? 1 : period === "7d" ? 7 : period === "30d" ? 30 : null;
  const from = days ? new Date(to.getTime() - days * DAY) : new Date("2000-01-01T00:00:00Z");
  const label = DASHBOARD_PERIODS.find((p) => p.id === period)!.label;
  return { from, to, days, label };
}
