import { DEMO_TODAY } from "./constants";

function jst(iso: string) {
  return new Date(new Date(iso).getTime() + 9 * 3600000);
}

const p = (n: number) => String(n).padStart(2, "0");

export function formatDate(iso: string) {
  const d = jst(iso);
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`;
}

export function formatDateTime(iso: string) {
  const d = jst(iso);
  return `${formatDate(iso)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** 「3日前」などの表示。基準はデモの今日（DEMO_TODAY）で、描画結果がサーバーとブラウザで一致する */
export function formatRelative(iso: string, base: string = DEMO_TODAY) {
  const diff = (new Date(base).getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "たった今";
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}日前`;
  return formatDate(iso);
}

export function formatNumber(n: number) {
  return n.toLocaleString("ja-JP");
}

export function formatYen(n: number) {
  return `${n.toLocaleString("ja-JP")}円`;
}

export function formatRating(n: number | null) {
  return n === null ? "—" : n.toFixed(2);
}

export function formatPercent(n: number | null, digits = 0) {
  return n === null ? "—" : `${n.toFixed(digits)}%`;
}
