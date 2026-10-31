/**
 * NAMARA REVIEW 1ファイル版デモ。
 * 本体（src/lib）のサンプルデータ・状態遷移・AI返信・集計・権限チェックをそのまま使い、
 * 画面だけを依存なしの DOM で描く。`npm run demo:build` で demo/namara-review-demo.html を生成する。
 * 外部への通信は一切行わない。
 */
import { checkReply, generateReply } from "@/lib/ai/reply-generator";
import {
  buildSuggestions,
  computeKpis,
  monthKey,
  monthLabel,
  monthlyReport,
  monthlyTrend,
  percentChange,
  ratingDistribution,
  recentMonthKeys,
  storeComparison,
  type MonthlyPoint,
  type Suggestion,
  type TopicStat,
} from "@/lib/analytics";
import { DEMO_TODAY, PLANS, ROLE_LABELS, STATUS_LABELS, TONE_DESCRIPTIONS, TONE_LABELS, TOPIC_LABELS } from "@/lib/constants";
import { currentMember, currentOrganization, demoReducer, STATE_VERSION, type DemoAction, type DemoState } from "@/lib/demo/reducer";
import { createIncomingReview, createSeedData } from "@/lib/demo/seed";
import { formatDate, formatDateTime, formatNumber, formatPercent, formatRating, formatRelative } from "@/lib/format";
import { can, canOnStore } from "@/lib/permissions";
import type { Review, Tone } from "@/lib/types";

type Page = "dashboard" | "reviews" | "replies" | "reports" | "settings";
type StatusFilter = "all" | "unreplied" | "pending" | "failed" | "published";

function initialState(): DemoState {
  return {
    ...createSeedData(),
    version: STATE_VERSION,
    currentUserId: "user_owner",
    selectedStoreId: "all",
    simulateFailure: false,
    syncCount: 0,
  };
}

let state = initialState();
const ui = {
  screen: "login" as "login" | "app",
  page: "dashboard" as Page,
  status: "all" as StatusFilter,
  ratings: [] as number[],
  query: "",
  limit: 20,
  openReviewId: null as string | null,
  editorText: "",
  editorTone: "friendly" as Tone,
  variant: 0,
  generating: false,
  confirmOpen: false,
  repliesTab: "pending" as "pending" | "drafts" | "history",
  month: monthKey(DEMO_TODAY),
  settingsStoreId: null as string | null,
  policyTone: null as Tone | null,
  policySignature: null as string | null,
  menuOpen: false,
};

const startedAt = Date.now();
function now() {
  const date = new Date(new Date(DEMO_TODAY).getTime() + (Date.now() - startedAt));
  const jst = new Date(date.getTime() + 9 * 3600000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${jst.getUTCFullYear()}-${p(jst.getUTCMonth() + 1)}-${p(jst.getUTCDate())}T${p(jst.getUTCHours())}:${p(jst.getUTCMinutes())}:${p(jst.getUTCSeconds())}+09:00`;
}

function dispatch(action: DemoAction) {
  const next = demoReducer(state, action);
  if (next === state) return false;
  state = next;
  return true;
}

// ───────── helpers ─────────
const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);
const app = document.getElementById("app")!;

function me() {
  return currentMember(state);
}
function org() {
  return currentOrganization(state);
}
function accessibleStores() {
  const m = me();
  return state.stores.filter((s) => canOnStore(m, "reply.edit", s));
}
function scopedReviews() {
  const allowed = new Set(accessibleStores().map((s) => s.id));
  return state.reviews.filter(
    (r) => allowed.has(r.storeId) && (state.selectedStoreId === "all" || r.storeId === state.selectedStoreId),
  );
}
function storeOf(id: string) {
  return state.stores.find((s) => s.id === id);
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(message: string, kind: "ok" | "error" | "info" = "ok") {
  const el = document.getElementById("toast")!;
  el.className = `toast show ${kind}`;
  el.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = "toast"), 3800);
}

const ICON: Record<string, string> = {
  home: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  line: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.4A8.4 8.4 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z"/>',
};
const icon = (name: string, cls = "i") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;

function stars(rating: number) {
  let out = `<span class="stars" role="img" aria-label="5段階中${rating}">`;
  for (let i = 1; i <= 5; i++) out += `<span class="${i <= rating ? "on" : "off"}">★</span>`;
  return out + "</span>";
}

const STATUS_CLASS: Record<Review["status"], string> = {
  unreplied: "warn",
  draft: "muted",
  pending: "brand",
  publishing: "brand",
  published: "ok",
  failed: "bad",
};
const badge = (status: Review["status"]) => `<span class="badge ${STATUS_CLASS[status]}">${STATUS_LABELS[status]}</span>`;

function delta(value: number | null, opts: { unit?: string; digits?: number; goodWhen?: "up" | "down"; label?: string } = {}) {
  const { unit = "%", digits = 0, goodWhen = "up", label = "" } = opts;
  if (value === null || Number.isNaN(value)) return `<span class="delta">${esc(label)} —</span>`;
  const v = Number(value.toFixed(digits));
  const dir = v > 0 ? "up" : v < 0 ? "down" : "flat";
  const cls = dir === "flat" ? "" : dir === goodWhen ? "good" : "bad";
  const arrow = dir === "up" ? "↗" : dir === "down" ? "↘" : "→";
  return `<span class="delta ${cls}">${arrow} <span class="dl">${esc(label)}</span> ${v > 0 ? "+" : ""}${v.toFixed(digits)}${unit}</span>`;
}

// ───────── charts (inline SVG) ─────────
function barChart(points: MonthlyPoint[]) {
  const W = 640;
  const H = 220;
  const pad = { l: 34, r: 8, t: 10, b: 26 };
  const max = Math.max(5, ...points.map((p) => p.count));
  const step = Math.ceil(max / 4 / 5) * 5 || 5;
  const top = step * 4;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const bw = (iw / points.length) * 0.62;
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="月別の口コミ件数">`;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ih - (ih * i) / 4;
    svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" class="grid"/><text x="${pad.l - 6}" y="${y + 4}" class="ax" text-anchor="end">${step * i}</text>`;
  }
  points.forEach((p, i) => {
    const x = pad.l + (iw / points.length) * i + (iw / points.length - bw) / 2;
    const h = (p.count / top) * ih;
    const y = pad.t + ih - h;
    svg += `<g class="hov"><rect x="${x - 4}" y="${pad.t}" width="${bw + 8}" height="${ih}" class="hit"/><path d="M${x},${y + ih * 0 + h} V${y + 4} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${y + h} Z" class="bar"/><title>${esc(monthLabel(p.key, true))}：${p.count}件</title></g>`;
    svg += `<text x="${x + bw / 2}" y="${H - 8}" class="ax" text-anchor="middle">${esc(p.label)}</text>`;
  });
  return svg + "</svg>";
}

function lineChart(points: MonthlyPoint[]) {
  const W = 640;
  const H = 200;
  const pad = { l: 34, r: 12, t: 12, b: 26 };
  const vals = points.map((p) => p.average).filter((v): v is number => v !== null);
  const min = vals.length ? Math.max(1, Math.floor((Math.min(...vals) - 0.3) * 2) / 2) : 1;
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const xs = (i: number) => pad.l + (iw / (points.length - 1)) * i;
  const ys = (v: number) => pad.t + ih - ((v - min) / (5 - min)) * ih;
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="月別の平均評価">`;
  for (let v = min; v <= 5.001; v += 0.5) {
    svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${ys(v)}" y2="${ys(v)}" class="grid"/><text x="${pad.l - 6}" y="${ys(v) + 4}" class="ax" text-anchor="end">${v.toFixed(1)}</text>`;
  }
  const pts = points.map((p, i) => (p.average === null ? null : [xs(i), ys(p.average)] as const)).filter(Boolean) as (readonly [number, number])[];
  svg += `<polyline points="${pts.map(([x, y]) => `${x},${y}`).join(" ")}" class="ln"/>`;
  points.forEach((p, i) => {
    if (p.average !== null)
      svg += `<g class="hov"><circle cx="${xs(i)}" cy="${ys(p.average)}" r="10" class="hit"/><circle cx="${xs(i)}" cy="${ys(p.average)}" r="4" class="dot"/><title>${esc(monthLabel(p.key, true))}：★${p.average.toFixed(2)}（${p.count}件）</title></g>`;
    svg += `<text x="${xs(i)}" y="${H - 8}" class="ax" text-anchor="middle">${esc(p.label)}</text>`;
  });
  return svg + "</svg>";
}

function distribution(reviews: Review[]) {
  return `<ul class="dist">${ratingDistribution(reviews)
    .map(
      (d) =>
        `<li><span class="dr">${d.rating}<span class="star">★</span></span><span class="track"><span style="width:${d.percent}%;background:${
          d.rating >= 4 ? "var(--c1)" : d.rating === 3 ? "#86b6ef" : "var(--neg)"
        }"></span></span><span class="dv">${d.count}件 (${d.percent.toFixed(0)}%)</span></li>`,
    )
    .join("")}</ul>`;
}

function topicBalance(topics: TopicStat[]) {
  const max = Math.max(1, ...topics.map((t) => Math.max(t.positive, t.negative)));
  return `<div class="tb-legend"><span><i style="background:var(--neg)"></i>不満</span><span></span><span><i style="background:var(--c1)"></i>好評</span></div><ul class="tb">${topics
    .map(
      (t) =>
        `<li><span class="neg"><em>${t.negative}</em><b style="width:${(t.negative / max) * 100}%"></b></span><span class="lbl">${esc(t.label)}</span><span class="pos"><b style="width:${(t.positive / max) * 100}%"></b><em>${t.positive}</em></span></li>`,
    )
    .join("")}</ul>`;
}

function suggestionList(list: Suggestion[]) {
  if (!list.length) return `<p class="muted center">分析に必要な口コミがまだありません。</p>`;
  const map = { high: ["bad", "alert", "優先度：高"], medium: ["warn", "bulb", "優先度：中"], info: ["brand", "trend", "強み"] } as const;
  return `<ul class="sugg">${list
    .map((s) => {
      const [cls, ic, label] = map[s.severity];
      return `<li><span class="sq ${cls}">${icon(ic)}</span><div><p class="st"><span class="sr">${label}：</span>${esc(s.title)}</p><p class="sd">${esc(s.detail)}</p></div></li>`;
    })
    .join("")}</ul>`;
}

// ───────── review item ─────────
function reviewItem(r: Review, compact = false) {
  const store = storeOf(r.storeId);
  const action =
    r.status === "published" ? "詳細を見る" : r.status === "failed" ? "再試行する" : r.status === "pending" ? "返信案を確認" : r.status === "draft" ? "下書きを編集" : "返信案を作成";
  const topics = compact
    ? ""
    : `<ul class="chips">${r.topics
        .map(
          (t) =>
            `<li class="${t.sentiment === "positive" ? "pos" : "neg"}">${t.sentiment === "positive" ? "👍" : "👎"} ${TOPIC_LABELS[t.topic]}${t.keyword ? `・${esc(t.keyword)}` : ""}</li>`,
        )
        .join("")}</ul>`;
  const reply =
    !compact && r.publishedReply
      ? `<div class="pubreply"><p class="xs muted">オーナーからの返信・${formatRelative(r.publishedReply.publishedAt)}</p><p class="clamp2">${esc(r.publishedReply.text)}</p></div>`
      : "";
  return `<article class="ri ${r.rating <= 2 && r.status !== "published" ? "low" : ""}">
    <header>${stars(r.rating)}<b>${esc(r.author)}</b><span class="xs muted">${formatRelative(r.createdAt)}</span>${
      state.selectedStoreId === "all" && store ? `<span class="tag">${esc(store.shortName)}</span>` : ""
    }<span class="push">${badge(r.status)}</span></header>
    <p class="${compact ? "clamp2" : ""}">${r.text ? esc(r.text) : '<span class="muted">（評価のみの投稿・本文なし）</span>'}</p>
    ${topics}${reply}
    <div class="right"><button class="btn sm ${r.status === "failed" ? "danger" : r.status === "published" ? "ghost" : "outline"}" data-open="${r.id}" ${
      r.status === "publishing" ? "disabled" : ""
    }>${action}</button></div>
  </article>`;
}

// ───────── pages ─────────
function dashboardPage() {
  const reviews = scopedReviews();
  const stores = accessibleStores();
  if (!stores.length) return emptyState("まだ店舗が登録されていません", "店舗設定から店舗を追加すると、ここに口コミの状況が表示されます。");
  const k = computeKpis(reviews, DEMO_TODAY);
  const trend = monthlyTrend(reviews, DEMO_TODAY, 12);
  const scope = state.selectedStoreId === "all" ? `全店舗（${stores.length}店舗）` : storeOf(state.selectedStoreId)?.name;
  const alerts = [
    k.pending ? `<button class="alert brand" data-go="replies">${icon("spark")}<span>承認待ちの返信案が <b>${k.pending}件</b> あります</span><span>→</span></button>` : "",
    k.failed ? `<button class="alert bad" data-go="replies" data-tab="drafts">${icon("alert")}<span>Googleへの投稿に失敗した返信が <b>${k.failed}件</b> あります</span><span>→</span></button>` : "",
  ].join("");
  return `
  ${pageHeader("ダッシュボード", `${esc(scope)}・${formatDate(DEMO_TODAY)} 時点`, `<button class="btn brand" data-go="reviews" data-status="unreplied">${icon("spark")}未返信に対応する</button>`)}
  ${alerts ? `<div class="alerts">${alerts}</div>` : ""}
  <section class="kpis">
    ${kpi("総口コミ数", formatNumber(k.total), "件", `<span class="xs muted">今月 +${k.thisMonth}件</span>`)}
    ${kpi("平均星評価", formatRating(k.average), "", delta(k.averageThisMonth !== null && k.averagePrevMonth !== null ? k.averageThisMonth - k.averagePrevMonth : null, { unit: "", digits: 2, label: "今月" }))}
    ${kpi("今月の新規口コミ", formatNumber(k.thisMonth), "件", delta(percentChange(k.thisMonth, k.prevMonthSamePeriod), { label: "前月同期比" }))}
    ${kpi("未返信", formatNumber(k.unreplied), "件", `<span class="xs muted">返信率 ${formatPercent(k.replyRate)}</span>`, k.unreplied > 0)}
  </section>
  <div class="grid g-2-1">
    ${card("口コミ件数の推移", "直近12か月・月別（今月は途中経過）", barChart(trend))}
    ${card("星評価の分布", `全期間 ${formatNumber(k.total)}件`, distribution(reviews))}
  </div>
  <div class="grid g-1-1">
    ${card("平均評価の推移", "直近12か月・月別（今月は途中経過）", lineChart(trend))}
    ${card("AIからの改善提案", "直近90日の口コミから", suggestionList(buildSuggestions(reviews, DEMO_TODAY).slice(0, 3)))}
  </div>
  <section class="card"><div class="ch row"><div><h3>最新の口コミ</h3><p class="cd">新しい順に5件</p></div><button class="btn outline sm" data-go="reviews">すべて見る →</button></div>
  <div class="list">${reviews.slice(0, 5).map((r) => reviewItem(r, true)).join("")}</div></section>`;
}

function matchStatus(r: Review, f: StatusFilter) {
  if (f === "all") return true;
  if (f === "unreplied") return r.status === "unreplied" || r.status === "draft";
  if (f === "published") return r.status === "published" || r.status === "publishing";
  return r.status === f;
}

function reviewsPage() {
  const reviews = scopedReviews();
  const q = ui.query.trim().toLowerCase();
  const filtered = reviews.filter(
    (r) =>
      matchStatus(r, ui.status) &&
      (!ui.ratings.length || ui.ratings.includes(r.rating)) &&
      (!q || r.text.toLowerCase().includes(q) || r.author.toLowerCase().includes(q)),
  );
  const counts = {
    unreplied: reviews.filter((r) => matchStatus(r, "unreplied")).length,
    pending: reviews.filter((r) => r.status === "pending").length,
    failed: reviews.filter((r) => r.status === "failed").length,
  };
  const opts: [StatusFilter, string][] = [
    ["all", "すべて"],
    ["unreplied", "未返信"],
    ["pending", "承認待ち"],
    ["failed", "投稿失敗"],
    ["published", "返信済み"],
  ];
  return `
  ${pageHeader("口コミ管理", "Googleの口コミを確認し、AIの返信案を作成・承認します。")}
  <div class="counts">${(["unreplied", "pending", "failed"] as const)
    .map(
      (k) =>
        `<button class="count ${ui.status === k ? "on" : ""}" data-status="${k}" aria-pressed="${ui.status === k}"><span class="xs muted">${
          { unreplied: "未返信", pending: "承認待ち", failed: "投稿失敗" }[k]
        }</span><b class="${k === "failed" && counts[k] ? "red" : ""}">${counts[k]}<small>件</small></b></button>`,
    )
    .join("")}</div>
  <section class="card pad filters">
    <input type="search" id="q" value="${esc(ui.query)}" placeholder="キーワード・投稿者名で検索（例：タン塩、待ち時間）" aria-label="口コミを検索">
    <div class="chiprow"><span class="xs muted">状態</span>${opts
      .map(([v, l]) => `<button class="pill ${ui.status === v ? "on" : ""}" data-status="${v}" aria-pressed="${ui.status === v}">${l}</button>`)
      .join("")}</div>
    <div class="chiprow"><span class="xs muted">星評価</span>${[5, 4, 3, 2, 1]
      .map((n) => `<button class="pill ${ui.ratings.includes(n) ? "on" : ""}" data-rating="${n}" aria-pressed="${ui.ratings.includes(n)}"><span class="star">★</span>${n}</button>`)
      .join("")}</div>
  </section>
  <p class="sm muted" aria-live="polite">${filtered.length}件の口コミ</p>
  <section class="card list">${
    filtered.length ? filtered.slice(0, ui.limit).map((r) => reviewItem(r)).join("") : `<div class="empty"><p><b>条件に合う口コミがありません</b></p><p class="sm muted">検索キーワードや絞り込み条件を変更してください。</p></div>`
  }</section>
  ${filtered.length > ui.limit ? `<div class="center"><button class="btn outline" data-more>さらに表示（残り${filtered.length - ui.limit}件）</button></div>` : ""}`;
}

function linePreview(r: Review) {
  const store = storeOf(r.storeId)!;
  const draft = state.drafts[r.id];
  return `<div class="line"><span class="lav">N</span><div><p class="xs muted">NAMARA REVIEW</p><div class="lbub"><div class="lhead">新しい口コミが届きました</div><div class="lbody"><b>${esc(
    store.shortName,
  )}</b>${stars(r.rating)}<p class="clamp3 muted">${esc(r.text || "（評価のみ）")}</p>${
    draft ? `<div class="ldraft"><p class="clamp3">AI返信案：${esc(draft.text)}</p></div>` : ""
  }</div><div class="lbtn">確認・承認する</div></div></div></div>`;
}

function repliesPage() {
  const reviews = scopedReviews();
  const pending = reviews.filter((r) => r.status === "pending");
  const drafts = reviews.filter((r) => r.status === "draft" || r.status === "failed");
  const unreplied = reviews.filter((r) => r.status === "unreplied");
  const ids = new Set(reviews.map((r) => r.id));
  const history = state.publications.filter((p) => ids.has(p.reviewId)).sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt)).slice(0, 30);
  const draftCard = (r: Review, meta: string, btn: string) => `<article class="card pad dc">
    <header>${stars(r.rating)}<b>${esc(r.author)}</b><span class="tag">${esc(storeOf(r.storeId)?.shortName)}</span><span class="xs muted">${formatRelative(r.createdAt)}</span></header>
    <p class="clamp2 muted sm">${esc(r.text || "（評価のみの投稿）")}</p>
    <div class="draftbox"><p class="xs brandc">${icon("spark", "i xs-i")} 返信案</p><p class="clamp4 pre">${esc(state.drafts[r.id]?.text ?? "")}</p></div>
    <div class="row wrap"><p class="xs muted">${meta}</p>${btn}</div></article>`;
  const tabs: [typeof ui.repliesTab, string, number | null][] = [
    ["pending", "承認待ち", pending.length],
    ["drafts", "下書き", drafts.length],
    ["history", "投稿履歴", null],
  ];
  let body = "";
  if (ui.repliesTab === "pending") {
    const target = pending[0] ?? unreplied[0];
    body = `<div class="grid g-main-side"><div class="stack">${
      pending.length
        ? pending
            .map((r) => {
              const d = state.drafts[r.id];
              return draftCard(r, d?.submittedBy ? `${esc(d.submittedBy)}さんが${formatRelative(d.submittedAt!)}に承認依頼` : "承認待ち", `<button class="btn brand sm" data-open="${r.id}">確認して承認</button>`);
            })
            .join("")
        : emptyState("承認待ちの返信案はありません", "スタッフが承認依頼をすると、ここに表示されます。")
    }</div>${card("LINEではこう届きます", "新着口コミとAI返信案をLINEで受け取り、ボタンから承認ページを開けます。", target ? linePreview(target) + `<p class="note">LINE通知は Phase 5 で実装します。現在は見え方のプレビューです。</p>` : "")}</div>`;
  } else if (ui.repliesTab === "drafts") {
    body = `<div class="stack">${
      drafts.length
        ? drafts
            .map((r) =>
              r.status === "failed"
                ? draftCard(r, '<span class="red">Googleへの投稿に失敗しました</span>', `<button class="btn danger sm" data-open="${r.id}">確認して再試行</button>`)
                : draftCard(r, `${esc(state.drafts[r.id]?.updatedBy)}・${formatRelative(state.drafts[r.id]?.updatedAt ?? DEMO_TODAY)}`, `<button class="btn outline sm" data-open="${r.id}">確認・編集</button>`),
            )
            .join("")
        : emptyState("下書きはありません", unreplied.length ? `未返信の口コミが${unreplied.length}件あります。右上のボタンで返信案をまとめて作成できます。` : "すべての口コミに対応済みです。")
    }</div>`;
  } else {
    body = `<section class="card"><div class="ch"><h3>投稿履歴</h3><p class="cd">同じ返信は「口コミID＋返信案の版数」で管理し、二重に投稿されないようにしています。</p></div><div class="tw"><table><thead><tr><th>日時</th><th>結果</th><th>店舗</th><th>口コミ</th><th>実行者</th></tr></thead><tbody>${history
      .map((p) => {
        const r = state.reviews.find((x) => x.id === p.reviewId);
        return `<tr><td class="xs">${formatDateTime(p.attemptedAt)}</td><td>${p.status === "success" ? '<span class="badge ok">成功</span>' : `<span class="badge bad" title="${esc(p.error)}">失敗（${p.attempt}回目）</span>`}</td><td class="xs">${esc(
          storeOf(r?.storeId ?? "")?.shortName,
        )}</td><td class="xs">${r ? `★${r.rating} ${esc(r.author)}` : "—"}</td><td class="xs">${esc(p.actor)}</td></tr>`;
      })
      .join("")}</tbody></table></div></section>`;
  }
  return `
  ${pageHeader(
    "AI返信管理",
    "AIが作成した返信案を確認・編集し、承認してGoogleに投稿します。AIが無断で投稿することはありません。",
    unreplied.length ? `<button class="btn brand" data-bulk>${icon("spark")}未返信${unreplied.length}件の返信案をまとめて作成</button>` : "",
  )}
  <div class="tabs" role="tablist">${tabs
    .map(([v, l, n]) => `<button role="tab" aria-selected="${ui.repliesTab === v}" class="${ui.repliesTab === v ? "on" : ""}" data-rtab="${v}">${l}${n !== null ? ` <span class="badge ${n && v === "pending" ? "brand" : "muted"}">${n}</span>` : ""}</button>`)
    .join("")}</div>
  ${body}`;
}

function reportsPage() {
  const reviews = scopedReviews();
  const stores = accessibleStores();
  const months = recentMonthKeys(DEMO_TODAY, 12).reverse();
  const r = monthlyReport(reviews, ui.month);
  const isCurrent = ui.month === monthKey(DEMO_TODAY);
  const mentions = r.topics.reduce((s, t) => s + t.positive + t.negative, 0);
  const pos = r.topics.reduce((s, t) => s + t.positive, 0);
  const low = r.distribution.filter((d) => d.rating <= 2).reduce((s, d) => s + d.count, 0);
  const best = [...r.topics].sort((a, b) => b.positive - a.positive)[0];
  const worst = [...r.topics].sort((a, b) => b.negative - a.negative)[0];
  const change = percentChange(r.count, r.previousCount);
  const summary = r.count
    ? `${monthLabel(ui.month, true)}${isCurrent ? `（${formatDate(DEMO_TODAY)}まで）` : ""}の口コミは${r.count}件${
        change !== null && !isCurrent ? `（前月比${change >= 0 ? "+" : ""}${change.toFixed(0)}%）` : ""
      }、平均評価は★${formatRating(r.average)}でした。${best?.positive ? `特に「${best.label}」への好意的な声が多く（${best.positive}件）、お店の強みになっています。` : ""}${
        worst?.negative ? `一方で「${worst.label}」への指摘が${worst.negative}件あり、改善の余地があります。` : "大きな不満の傾向は見られませんでした。"
      }`
    : "";
  const ids = new Set(stores.map((s) => s.id));
  const comparison = storeComparison(stores, state.reviews.filter((x) => ids.has(x.storeId)), ui.month);
  const quotes = (list: Review[]) =>
    list.length ? `<ul class="stack">${list.map((q) => `<li class="quote">${stars(q.rating)}<p>${esc(q.text)}</p></li>`).join("")}</ul>` : `<p class="muted sm">該当する口コミはありません。</p>`;
  return `
  ${pageHeader("AI分析レポート", `${state.selectedStoreId === "all" ? "全店舗" : esc(storeOf(state.selectedStoreId)?.name)}・${monthLabel(ui.month, true)}の口コミ分析`, `<select id="month" aria-label="対象月">${months.map((m) => `<option value="${m}" ${m === ui.month ? "selected" : ""}>${monthLabel(m, true)}</option>`).join("")}</select><button class="btn outline" data-print>印刷・PDF保存</button>`)}
  <section class="kpis">
    ${kpi("口コミ件数", String(r.count), "件", isCurrent ? `<span class="xs muted">月途中（前月：${r.previousCount}件）</span>` : delta(change, { label: "前月比" }))}
    ${kpi("平均星評価", formatRating(r.average), "", delta(r.average !== null && r.previousAverage !== null ? r.average - r.previousAverage : null, { unit: "", digits: 2, label: "前月差" }))}
    ${kpi("ポジティブ率", mentions ? formatPercent((pos / mentions) * 100) : "—", "", `<span class="xs muted">言及${mentions}件のうち好評${pos}件</span>`)}
    ${kpi("低評価（★2以下）", String(low), "件", `<span class="xs muted">全体の${r.count ? ((low / r.count) * 100).toFixed(0) : 0}%</span>`, low > 0)}
  </section>
  ${
    r.count
      ? `<section class="card ai"><div class="ch"><h3>${icon("spark", "i brandc")} AI総評</h3><p class="cd">Phase 1 では集計結果から自動で文章を作成しています（Phase 6 でOpenAIによる分析に置き換え）</p></div><p class="pad0">${esc(summary)}</p></section>
  <div class="grid g-1-1">${card("カテゴリ別の評価", "料理・接客・価格・雰囲気などへの言及数", topicBalance(r.topics))}${card("改善提案", "対象月までの直近3か月の口コミから", suggestionList(buildSuggestions(reviews, isCurrent ? DEMO_TODAY : `${ui.month}-28T23:59:00+09:00`).filter((s) => s.id !== "low-unreplied")))}</div>
  <div class="grid g-1-1">${card("ポジティブ評価の傾向", "", quotes(r.positiveQuotes))}${card("ネガティブ評価の傾向", "", quotes(r.negativeQuotes))}</div>`
      : emptyState("この月の口コミはありません", "別の月を選択してください。")
  }
  ${
    stores.length > 1
      ? `<section class="card"><div class="ch"><h3>店舗別比較</h3><p class="cd">${monthLabel(ui.month, true)}・担当している全店舗</p></div><div class="tw"><table><thead><tr><th>店舗</th><th class="r">口コミ件数</th><th class="r">平均評価</th><th class="r">前月差</th><th class="r">返信率</th><th class="r">未返信</th></tr></thead><tbody>${comparison
          .map(
            (c) =>
              `<tr><td><b>${esc(c.store.shortName)}</b></td><td class="r">${c.count}件</td><td class="r">★${formatRating(c.average)}</td><td class="r">${delta(
                c.average !== null && c.previousAverage !== null ? c.average - c.previousAverage : null,
                { unit: "", digits: 2 },
              )}</td><td class="r">${formatPercent(c.replyRate)}</td><td class="r ${c.unreplied ? "warnc" : ""}">${c.unreplied}件</td></tr>`,
          )
          .join("")}</tbody></table></div></section>`
      : ""
  }`;
}

function settingsPage() {
  const stores = accessibleStores();
  const m = me();
  const store =
    stores.find((s) => s.id === (state.selectedStoreId !== "all" ? state.selectedStoreId : ui.settingsStoreId)) ?? stores[0];
  if (!store) return `${pageHeader("店舗設定")}${emptyState("まだ店舗が登録されていません", "")}`;
  const canEdit = canOnStore(m, "policy.edit", store);
  const tone = ui.policyTone ?? store.policy.tone;
  const signature = ui.policySignature ?? store.policy.signature;
  const sample = state.reviews.find((r) => r.storeId === store.id && r.text && r.rating === 5);
  const preview = sample ? generateReply({ review: sample, store, policy: { ...store.policy, tone, signature }, tone }) : "";
  const members = state.members.filter((x) => x.organizationId === m.organizationId);
  const plan = PLANS[org().plan];
  return `
  ${pageHeader("店舗設定", esc(store.name), stores.length > 1 && state.selectedStoreId === "all" ? `<select id="settingsStore" aria-label="設定する店舗">${stores.map((s) => `<option value="${s.id}" ${s.id === store.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>` : "")}
  <div class="grid g-main-side">
    <section class="card"><div class="ch"><h3>AI返信方針</h3><p class="cd">${esc(store.name)} の返信案を作るときにAIが守るルールです。</p></div><div class="pad0 stack">
      <fieldset ${canEdit ? "" : "disabled"}><legend class="sm b">返信トーン</legend><div class="tones">${(["polite", "friendly", "casual"] as Tone[])
        .map((t) => `<button class="tone ${tone === t ? "on" : ""}" data-ptone="${t}" role="radio" aria-checked="${tone === t}"><b>${TONE_LABELS[t]}</b><span class="xs muted">${TONE_DESCRIPTIONS[t]}</span></button>`)
        .join("")}</div></fieldset>
      <label class="sm b" for="sig">署名</label><input id="sig" value="${esc(signature)}" ${canEdit ? "" : "disabled"}>
      <div class="row"><span class="xs muted">${canEdit ? "" : "返信方針の編集はオーナー・店長のみ可能です。"}</span><button class="btn" data-savepolicy="${store.id}" ${canEdit ? "" : "disabled"}>保存する</button></div>
    </div></section>
    ${card("返信プレビュー", "保存前の設定で、実際の口コミへの返信例を表示します。", sample ? `<p class="quote xs">★${sample.rating}「${esc(sample.text)}」</p><p class="pre box sm">${esc(preview)}</p>` : "")}
  </div>
  <div class="grid g-1-1">
    <section class="card"><div class="ch"><h3>担当者</h3><p class="cd">担当店舗以外の口コミ・設定は表示されません。</p></div><div class="tw"><table><thead><tr><th>氏名</th><th>権限</th><th>担当店舗</th></tr></thead><tbody>${members
      .map(
        (x) =>
          `<tr><td><b>${esc(x.name)}</b><br><span class="xs muted">${esc(x.email)}</span></td><td><span class="badge ${x.role === "owner" ? "navy" : x.role === "manager" ? "brand" : "muted"}">${ROLE_LABELS[x.role]}</span></td><td class="xs">${
            x.role === "owner" ? "全店舗" : x.storeIds.map((id) => esc(storeOf(id)?.shortName)).join("、")
          }</td></tr>`,
      )
      .join("")}</tbody></table></div></section>
    ${card(
      "連携と契約",
      "Phase 1 では外部サービスに接続していません",
      `<ul class="kv"><li><span>Google口コミ</span>${store.googleStatus === "connected" ? '<span class="badge ok">接続済み（サンプル）</span>' : store.googleStatus === "error" ? '<span class="badge bad">要再接続（サンプル）</span>' : '<span class="badge muted">未接続</span>'}</li><li><span>LINE通知</span>${store.lineStatus === "connected" ? '<span class="badge ok">接続済み（サンプル）</span>' : '<span class="badge muted">未接続</span>'}</li><li><span>AI返信</span><span class="badge muted">デモ（テンプレート）</span></li>${
        can(m.role, "billing.view") ? `<li><span>契約プラン</span><b>${plan.name}（${stores.length}/${plan.stores}店舗）</b></li>` : ""
      }</ul><label class="sw"><input type="checkbox" id="simfail" ${state.simulateFailure ? "checked" : ""}> 投稿失敗をシミュレートする（エラー表示の確認用）</label>`,
    )}
  </div>`;
}

// ───────── editor panel ─────────
function editorPanel() {
  const r = state.reviews.find((x) => x.id === ui.openReviewId);
  if (!r) return "";
  const store = storeOf(r.storeId)!;
  const m = me();
  const draft = state.drafts[r.id];
  const canEdit = canOnStore(m, "reply.edit", store);
  const canApprove = canOnStore(m, "reply.approve", store);
  const locked = r.status === "published" || r.status === "publishing";
  const checks = ui.editorText ? checkReply(ui.editorText, store.policy, r.author) : [];
  const hasError = checks.some((c) => c.level === "error");
  const fail = state.publications.find((p) => p.reviewId === r.id && p.status === "failed");
  const pubs = state.publications.filter((p) => p.reviewId === r.id);
  let editor = "";
  if (!locked) {
    const toneBtns = (["polite", "friendly", "casual"] as Tone[])
      .map((t) => `<button class="tone sm ${ui.editorTone === t ? "on" : ""}" data-etone="${t}" role="radio" aria-checked="${ui.editorTone === t}" ${canEdit && !ui.generating ? "" : "disabled"}>${TONE_LABELS[t]}</button>`)
      .join("");
    const area = ui.generating
      ? `<div class="gen" aria-busy="true"><p class="sm muted"><span class="spin"></span> AIが口コミの内容を読み取って返信案を作成しています…</p><div class="sk"></div><div class="sk w9"></div><div class="sk w8"></div></div>`
      : ui.editorText || draft
        ? `<textarea id="reply" rows="9" aria-label="返信文" ${canEdit ? "" : "readonly"}>${esc(ui.editorText)}</textarea><p class="row xs muted"><span>${draft && ui.editorText === draft.text ? "保存済み" : "未保存の変更があります"}</span><span class="${ui.editorText.length > store.policy.maxLength ? "warnc" : ""}">${ui.editorText.length} / 目安 ${store.policy.maxLength}文字</span></p>`
        : `<div class="dashed"><p class="sm muted">店舗の返信方針（${TONE_LABELS[store.policy.tone]}・署名「${esc(store.policy.signature || "なし")}」）に沿って、AIが返信案を作成します。</p><button class="btn brand" data-generate ${canEdit ? "" : "disabled"}>${icon("spark")}AIで返信案を作成</button></div>`;
    const checkList =
      ui.editorText && !ui.generating
        ? `<ul class="checks">${
            checks.length
              ? checks.map((c) => `<li class="${c.level === "error" ? "red" : "warnc"}">⚠ ${esc(c.message)}</li>`).join("")
              : '<li class="okc">✓ NGワード・補償の約束・個人情報のチェックで問題は見つかりませんでした</li>'
          }</ul>`
        : "";
    editor = `<section class="stack"><h4>${icon("spark", "i brandc")} 返信案</h4>
      ${r.status === "failed" && fail ? `<div class="alert bad static">${icon("alert")}<span><b>前回の投稿に失敗しました（${formatDateTime(fail.attemptedAt)}）</b><br>${esc(fail.error)}</span></div>` : ""}
      ${r.status === "pending" && draft?.submittedBy ? `<p class="info">${esc(draft.submittedBy)}さんが ${formatDateTime(draft.submittedAt!)} に承認依頼しました</p>` : ""}
      <p class="xs muted">返信のトーン</p><div class="tones three">${toneBtns}</div>
      ${area}${checkList}
      ${!canEdit ? '<p class="xs muted">この店舗の返信を編集する権限がありません。</p>' : !canApprove ? '<p class="xs muted">スタッフ権限では承認依頼までできます。Googleへの投稿はオーナー・店長が承認して行います。</p>' : ""}
    </section>`;
  }
  const footer =
    !locked && canEdit && (ui.editorText || draft) && !ui.generating
      ? `<footer class="pfoot"><div class="row wrap"><span><button class="btn outline sm" data-regen>${icon("refresh")}再生成</button> <button class="btn outline sm" data-savedraft>下書き保存</button></span><span class="row wrap gap">${
          r.status === "pending" && canApprove ? `<button class="btn outline" data-sendback>差し戻す</button>` : ""
        }${!canApprove && r.status !== "pending" ? `<button class="btn" data-submit ${hasError ? "disabled" : ""}>承認を依頼する</button>` : ""}${
          canApprove ? `<button class="btn brand" data-confirm ${hasError ? "disabled" : ""}>${r.status === "failed" ? "再試行して投稿" : "承認してGoogleに投稿"}</button>` : ""
        }</span></div></footer>`
      : "";
  const confirm = ui.confirmOpen
    ? `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="cft"><div class="mbox"><h3 id="cft">この返信をGoogleに投稿しますか？</h3><p class="sm muted">投稿すると、Googleマップ上で誰でも閲覧できるようになります。内容をもう一度ご確認ください。</p><p class="pre box sm">${esc(
        ui.editorText,
      )}</p><p class="xs muted">デモでは実際には投稿されません。</p><div class="row end gap"><button class="btn outline" data-cancelconfirm>戻って編集</button><button class="btn brand" data-publish>承認して投稿</button></div></div></div>`
    : "";
  return `<div class="overlay" data-close></div><aside class="panel" role="dialog" aria-modal="true" aria-labelledby="pt">
    <header class="phead"><div class="row wrap gap">${badge(r.status)}<span class="xs muted">${esc(store.name)}</span></div><h3 id="pt">${stars(r.rating)} ${esc(r.author)}</h3><p class="xs muted">${formatDateTime(r.createdAt)} にGoogleへ投稿</p><button class="iconbtn close" data-close aria-label="閉じる">${icon("x")}</button></header>
    <div class="pbody stack">
      <p class="box">${r.text ? esc(r.text) : "（評価のみの投稿・本文なし）"}</p>
      <ul class="chips">${r.topics.map((t) => `<li class="${t.sentiment === "positive" ? "pos" : "neg"}">${t.sentiment === "positive" ? "👍" : "👎"} ${TOPIC_LABELS[t.topic]}${t.keyword ? `・${esc(t.keyword)}` : ""}</li>`).join("")}</ul>
      ${r.publishedReply ? `<section><h4 class="okc">✓ Googleに公開済みの返信</h4><p class="box okbox pre">${esc(r.publishedReply.text)}</p><p class="xs muted">${formatDateTime(r.publishedReply.publishedAt)} に投稿</p></section>` : ""}
      ${editor}
      ${pubs.length ? `<section><h4>投稿履歴</h4><ul class="xs stack">${pubs.map((p) => `<li>${p.status === "success" ? "✅" : "⚠️"} ${formatDateTime(p.attemptedAt)}・${esc(p.actor)}・${p.attempt}回目・${p.status === "success" ? "投稿成功" : "投稿失敗"}</li>`).join("")}</ul></section>` : ""}
    </div>${footer}</aside>${confirm}`;
}

// ───────── layout ─────────
function pageHeader(title: string, desc = "", actions = "") {
  return `<div class="ph"><div><h1>${title}</h1>${desc ? `<p class="muted sm">${desc}</p>` : ""}</div>${actions ? `<div class="row wrap gap">${actions}</div>` : ""}</div>`;
}
function card(title: string, desc: string, body: string) {
  return `<section class="card"><div class="ch"><h3>${title}</h3>${desc ? `<p class="cd">${desc}</p>` : ""}</div><div class="pad0">${body}</div></section>`;
}
function kpi(title: string, value: string, unit: string, foot: string, attention = false) {
  return `<div class="card kpi ${attention ? "att" : ""}"><p class="sm muted">${title}</p><p class="kv1"><b>${value}</b>${unit ? `<span class="muted sm">${unit}</span>` : ""}</p><div>${foot}</div></div>`;
}
function emptyState(title: string, desc: string) {
  return `<div class="card empty"><p><b>${title}</b></p>${desc ? `<p class="sm muted">${desc}</p>` : ""}</div>`;
}

const NAV: [Page, string, string, string][] = [
  ["dashboard", "ダッシュボード", "ホーム", "home"],
  ["reviews", "口コミ管理", "口コミ", "chat"],
  ["replies", "AI返信管理", "AI返信", "spark"],
  ["reports", "AI分析レポート", "分析", "chart"],
  ["settings", "店舗設定", "設定", "gear"],
];

function shell(content: string) {
  const reviews = scopedReviews();
  const counts = {
    reviews: reviews.filter((r) => r.status === "unreplied" || r.status === "draft").length,
    replies: reviews.filter((r) => r.status === "pending").length,
  } as Record<string, number>;
  const o = org();
  const m = me();
  const stores = accessibleStores();
  const members = state.members.filter((x) => x.organizationId === o.id && !x.invited);
  const nav = NAV.map(
    ([p, label, , ic]) =>
      `<button class="nv ${ui.page === p ? "on" : ""}" data-go="${p}" aria-current="${ui.page === p ? "page" : "false"}">${icon(ic)}<span>${label}</span>${counts[p] ? `<em class="${p === "replies" ? "b" : ""}">${counts[p]}</em>` : ""}</button>`,
  ).join("");
  const side = `<div class="sb"><div class="logo"><span class="lm">N</span><span><b>NAMARA REVIEW</b><small>by なまらグルメ</small></span></div>
    <div class="orgbox"><small>ご契約法人</small><b>${esc(o.name)}</b><small>${PLANS[o.plan].name}プラン</small></div>
    <nav aria-label="メインメニュー">${nav}</nav>
    <div class="demo-note"><b>デモモード</b><p>サンプルデータで動作しています。Google・LINE・AIには接続していません。</p></div></div>`;
  return `<a class="skip" href="#main">本文へ移動</a>
  <aside class="side">${side}</aside>
  ${ui.menuOpen ? `<div class="overlay" data-closemenu></div><aside class="side mobile">${side}</aside>` : ""}
  <div class="main">
    <header class="top">
      <button class="iconbtn mob" data-menu aria-label="メニューを開く">${icon("menu")}</button>
      <select id="store" aria-label="表示する店舗">${stores.length > 1 ? `<option value="all">全店舗（${stores.length}店舗）</option>` : ""}${stores
        .map((s) => `<option value="${s.id}" ${state.selectedStoreId === s.id ? "selected" : ""}>${esc(s.shortName)}</option>`)
        .join("")}</select>
      <span class="push"></span>
      <button class="btn outline sm" data-sync>${icon("refresh")}<span class="hide-sm">口コミを同期</span></button>
      <select id="user" aria-label="ログインユーザーを切り替え（デモ）">${members
        .map((x) => `<option value="${x.id}" ${x.id === m.id ? "selected" : ""}>${esc(x.name)}（${ROLE_LABELS[x.role]}）</option>`)
        .join("")}</select>
      <button class="btn ghost sm" data-logout>${icon("building")}<span class="hide-sm">法人を切り替え</span></button>
    </header>
    <main id="main">${content}</main>
  </div>
  <nav class="bottom" aria-label="メインメニュー">${NAV.map(
    ([p, , short, ic]) => `<button class="${ui.page === p ? "on" : ""}" data-go="${p}">${icon(ic)}<span>${short}</span>${counts[p] ? `<em>${counts[p] > 99 ? "99+" : counts[p]}</em>` : ""}</button>`,
  ).join("")}</nav>
  ${ui.openReviewId ? editorPanel() : ""}`;
}

function loginScreen() {
  return `<main class="login"><section class="lhero"><div class="logo"><span class="lm">N</span><span><b>NAMARA REVIEW</b><small>by なまらグルメ</small></span></div>
  <div><p class="hero">口コミ管理は、AIにおまかせ。<br>お店はお客様に集中できる。</p><p class="heros">Google口コミの確認・AI返信・分析をひとつに。LINEで届いた返信案を確認して承認するだけで、口コミ対応が完了します。</p></div><small>運営：なまらグルメ</small></section>
  <section class="lform"><div><h1>デモを体験する</h1><p class="sm muted">法人と担当者を選ぶと、その法人の専用ページが開きます。法人ごとにデータは完全に分かれています。</p>
  ${state.organizations
    .map(
      (o) =>
        `<div class="orgcard"><div class="oh">${icon("building", "i brandc")}<b>${esc(o.name)}</b><span class="xs muted push">${PLANS[o.plan].name}</span></div><ul>${state.members
          .filter((x) => x.organizationId === o.id && !x.invited)
          .map(
            (x) =>
              `<li><button data-login="${x.id}"><span class="av">${esc(x.name.slice(0, 1))}</span><span class="grow"><b>${esc(x.name)}</b><small>${esc(x.email)}</small></span><span class="xs muted">${ROLE_LABELS[x.role]}</span><span class="muted">›</span></button></li>`,
          )
          .join("")}</ul></div>`,
    )
    .join("")}
  <p class="note">これはパソコンの中だけで動くデモです。インターネットには一切送信しません。ページを再読み込みすると初期状態に戻ります。</p></div></section></main>`;
}

function render() {
  const scrollY = window.scrollY;
  const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
  const focusId = active?.id;
  const sel = active && "selectionStart" in active ? [active.selectionStart, active.selectionEnd] : null;
  app.innerHTML = ui.screen === "login" ? loginScreen() : shell(PAGES[ui.page]());
  if (focusId) {
    const el = document.getElementById(focusId) as HTMLInputElement | null;
    if (el) {
      el.focus();
      if (sel && el.setSelectionRange && sel[0] !== null) el.setSelectionRange(sel[0], sel[1]);
    }
  }
  window.scrollTo(0, scrollY);
}

const PAGES: Record<Page, () => string> = {
  dashboard: dashboardPage,
  reviews: reviewsPage,
  replies: repliesPage,
  reports: reportsPage,
  settings: settingsPage,
};

// ───────── actions ─────────
function openReview(id: string) {
  const r = state.reviews.find((x) => x.id === id)!;
  const draft = state.drafts[id];
  ui.openReviewId = id;
  ui.editorText = draft?.text ?? "";
  ui.editorTone = draft?.tone ?? storeOf(r.storeId)!.policy.tone;
  ui.variant = 0;
  ui.confirmOpen = false;
  render();
}

async function generate(tone: Tone, variant: number) {
  const r = state.reviews.find((x) => x.id === ui.openReviewId);
  if (!r) return;
  const store = storeOf(r.storeId)!;
  ui.generating = true;
  render();
  await new Promise((res) => setTimeout(res, 700));
  const text = generateReply({ review: r, store, policy: store.policy, tone, variant });
  ui.generating = false;
  ui.editorText = text;
  ui.editorTone = tone;
  ui.variant = variant;
  dispatch({ type: "saveDraft", reviewId: r.id, text, tone, source: "ai", at: now() });
  render();
}

function saveIfDirty() {
  const id = ui.openReviewId!;
  const d = state.drafts[id];
  if (!d || d.text !== ui.editorText || d.tone !== ui.editorTone)
    dispatch({ type: "saveDraft", reviewId: id, text: ui.editorText, tone: ui.editorTone, source: "edited", at: now() });
}

async function publish() {
  const id = ui.openReviewId!;
  ui.confirmOpen = false;
  saveIfDirty();
  const draft = state.drafts[id];
  const key = `${id}:${draft.version}`;
  if (!dispatch({ type: "publishStarted", reviewId: id, idempotencyKey: key, at: now() })) {
    toast("この返信は投稿できない状態です", "error");
    return render();
  }
  render();
  await new Promise((res) => setTimeout(res, 1200));
  const r = state.reviews.find((x) => x.id === id)!;
  const store = storeOf(r.storeId)!;
  const error = state.simulateFailure
    ? "Google Business Profile API がエラーを返しました（デモ：失敗シミュレーション中）"
    : store.googleStatus !== "connected"
      ? "Googleの認証の有効期限が切れています（デモ）。店舗設定からGoogle連携を再接続してください。"
      : null;
  dispatch({ type: "publishFinished", reviewId: id, idempotencyKey: key, ok: !error, error, at: now() });
  toast(error ? `投稿に失敗しました：${error}` : "Googleに返信を投稿しました（デモ）", error ? "error" : "ok");
  render();
}

app.addEventListener("click", async (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("button, [data-close], [data-closemenu]");
  if (!t) return;
  const d = t.dataset;
  if (d.login) {
    dispatch({ type: "switchUser", userId: d.login });
    state = { ...state, selectedStoreId: "all" };
    Object.assign(ui, { screen: "app", page: "dashboard", status: "all", ratings: [], query: "", settingsStoreId: null, policyTone: null, policySignature: null });
    window.scrollTo(0, 0);
    return render();
  }
  if (d.logout !== undefined) {
    ui.screen = "login";
    return render();
  }
  if (d.go) {
    ui.page = d.go as Page;
    ui.menuOpen = false;
    if (d.status) ui.status = d.status as StatusFilter;
    if (d.tab) ui.repliesTab = d.tab as typeof ui.repliesTab;
    ui.limit = 20;
    render();
    return window.scrollTo(0, 0);
  }
  if (d.menu !== undefined) return ((ui.menuOpen = true), render());
  if (d.closemenu !== undefined) return ((ui.menuOpen = false), render());
  if (d.status && ui.page === "reviews") {
    ui.status = ui.status === d.status && t.classList.contains("count") ? "all" : (d.status as StatusFilter);
    ui.limit = 20;
    return render();
  }
  if (d.rating) {
    const n = Number(d.rating);
    ui.ratings = ui.ratings.includes(n) ? ui.ratings.filter((x) => x !== n) : [...ui.ratings, n];
    return render();
  }
  if (d.more !== undefined) return ((ui.limit += 20), render());
  if (d.open) return openReview(d.open);
  if (d.close !== undefined) return ((ui.openReviewId = null), (ui.confirmOpen = false), render());
  if (d.generate !== undefined) return generate(ui.editorTone, 0);
  if (d.regen !== undefined) return generate(ui.editorTone, ui.variant + 1);
  if (d.etone) return ui.editorText ? generate(d.etone as Tone, ui.variant) : ((ui.editorTone = d.etone as Tone), render());
  if (d.savedraft !== undefined) {
    saveIfDirty();
    toast("下書きを保存しました");
    return render();
  }
  if (d.submit !== undefined) {
    saveIfDirty();
    if (dispatch({ type: "submitForApproval", reviewId: ui.openReviewId!, at: now() })) toast("承認依頼を送りました（オーナー・店長のLINEに通知：Phase 5）");
    return render();
  }
  if (d.sendback !== undefined) {
    dispatch({ type: "sendBack", reviewId: ui.openReviewId!, at: now() });
    toast("下書きに差し戻しました", "info");
    return render();
  }
  if (d.confirm !== undefined) return ((ui.confirmOpen = true), render());
  if (d.cancelconfirm !== undefined) return ((ui.confirmOpen = false), render());
  if (d.publish !== undefined) return publish();
  if (d.rtab) return ((ui.repliesTab = d.rtab as typeof ui.repliesTab), render());
  if (d.bulk !== undefined) {
    let created = 0;
    for (const r of scopedReviews().filter((x) => x.status === "unreplied")) {
      const store = storeOf(r.storeId)!;
      const text = generateReply({ review: r, store, policy: store.policy, tone: store.policy.tone, variant: created });
      if (dispatch({ type: "saveDraft", reviewId: r.id, text, tone: store.policy.tone, source: "ai", at: now() })) created++;
    }
    ui.repliesTab = "drafts";
    toast(`${created}件の返信案を作成しました。内容を確認してください`);
    return render();
  }
  if (d.sync !== undefined) {
    const at = now();
    const connected = state.stores.filter((s) => s.googleStatus === "connected" && s.organizationId === org().id).slice(0, 2);
    const incoming = connected.map((s, i) => createIncomingReview(s, state.syncCount * 10 + i, at));
    dispatch({ type: "reviewsSynced", reviews: incoming, at });
    toast(`Google口コミを同期しました（新着${incoming.length}件・デモ）`);
    return render();
  }
  if (d.ptone) return ((ui.policyTone = d.ptone as Tone), render());
  if (d.savepolicy) {
    const store = storeOf(d.savepolicy)!;
    const policy = { ...store.policy, tone: ui.policyTone ?? store.policy.tone, signature: (ui.policySignature ?? store.policy.signature).trim() };
    if (dispatch({ type: "updatePolicy", storeId: store.id, policy, at: now() })) toast("AI返信方針を保存しました");
    ui.policyTone = null;
    ui.policySignature = null;
    return render();
  }
  if (d.print !== undefined) window.print();
});

app.addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === "q") {
    ui.query = el.value;
    ui.limit = 20;
    render();
  } else if (el.id === "reply") {
    ui.editorText = el.value;
    render();
  } else if (el.id === "sig") {
    ui.policySignature = el.value;
    render();
  }
});

app.addEventListener("change", (e) => {
  const el = e.target as HTMLSelectElement & HTMLInputElement;
  if (el.id === "store") dispatch({ type: "selectStore", storeId: el.value });
  else if (el.id === "user") {
    dispatch({ type: "switchUser", userId: el.value });
    toast(`${me().name}（${ROLE_LABELS[me().role]}）に切り替えました`, "info");
  } else if (el.id === "month") ui.month = el.value;
  else if (el.id === "settingsStore") {
    ui.settingsStoreId = el.value;
    ui.policyTone = null;
    ui.policySignature = null;
  } else if (el.id === "simfail") {
    dispatch({ type: "setSimulateFailure", value: el.checked });
    toast(el.checked ? "投稿失敗のシミュレーションをオンにしました" : "投稿失敗のシミュレーションをオフにしました", "info");
  } else return;
  render();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && (ui.openReviewId || ui.menuOpen)) {
    if (ui.confirmOpen) ui.confirmOpen = false;
    else {
      ui.openReviewId = null;
      ui.menuOpen = false;
    }
    render();
  }
});

render();
