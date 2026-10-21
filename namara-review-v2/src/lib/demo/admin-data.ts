import type { IntegrationStatus, PlanId } from "@/lib/types";

/**
 * 運営管理画面（なまらグルメ社内用）のサンプルデータ。すべて架空の企業。
 * Phase 6 で organizations / subscriptions / integration_connections などの集計に置き換える。
 */

export type ContractStatus = "active" | "trial" | "past_due" | "cancelled";

export interface Tenant {
  id: string;
  name: string;
  plan: PlanId;
  status: ContractStatus;
  stores: number;
  googleStatus: IntegrationStatus;
  lineConnected: boolean;
  errors7d: number;
  reviews30d: number;
  replyRate: number;
  startedAt: string;
  lastActiveAt: string;
}

export type TicketStatus = "open" | "in_progress" | "resolved";

export interface SupportTicket {
  id: string;
  tenantId: string;
  subject: string;
  status: TicketStatus;
  priority: "high" | "normal";
  createdAt: string;
}

export const TENANTS: Tenant[] = [
  { id: "t01", name: "株式会社なまらダイニング", plan: "standard", status: "active", stores: 3, googleStatus: "error", lineConnected: true, errors7d: 3, reviews30d: 52, replyRate: 88, startedAt: "2025-10-01", lastActiveAt: "2026-10-21T17:40:00+09:00" },
  { id: "t02", name: "すすきの串焼き 炎（個人）", plan: "starter", status: "active", stores: 1, googleStatus: "connected", lineConnected: true, errors7d: 0, reviews30d: 14, replyRate: 100, startedAt: "2026-01-15", lastActiveAt: "2026-10-21T11:20:00+09:00" },
  { id: "t03", name: "北海フードサービス株式会社", plan: "premium", status: "active", stores: 8, googleStatus: "connected", lineConnected: true, errors7d: 1, reviews30d: 163, replyRate: 94, startedAt: "2025-12-01", lastActiveAt: "2026-10-21T16:05:00+09:00" },
  { id: "t04", name: "カフェ・ド・円山（個人）", plan: "starter", status: "trial", stores: 1, googleStatus: "connected", lineConnected: false, errors7d: 0, reviews30d: 6, replyRate: 50, startedAt: "2026-10-10", lastActiveAt: "2026-10-20T09:15:00+09:00" },
  { id: "t05", name: "株式会社スープカレー工房", plan: "standard", status: "active", stores: 3, googleStatus: "connected", lineConnected: true, errors7d: 0, reviews30d: 47, replyRate: 91, startedAt: "2026-03-01", lastActiveAt: "2026-10-21T14:48:00+09:00" },
  { id: "t06", name: "小樽寿司 銀鱗（個人）", plan: "starter", status: "past_due", stores: 1, googleStatus: "connected", lineConnected: true, errors7d: 0, reviews30d: 9, replyRate: 78, startedAt: "2026-02-20", lastActiveAt: "2026-10-12T20:01:00+09:00" },
  { id: "t07", name: "函館ベイ飲食グループ", plan: "premium", status: "active", stores: 6, googleStatus: "connected", lineConnected: true, errors7d: 2, reviews30d: 121, replyRate: 85, startedAt: "2026-04-01", lastActiveAt: "2026-10-21T10:32:00+09:00" },
  { id: "t08", name: "ジンギスカン 羊の丘（個人）", plan: "starter", status: "trial", stores: 1, googleStatus: "not_connected", lineConnected: false, errors7d: 0, reviews30d: 0, replyRate: 0, startedAt: "2026-10-18", lastActiveAt: "2026-10-18T15:00:00+09:00" },
  { id: "t09", name: "株式会社ラーメン北斗", plan: "standard", status: "cancelled", stores: 2, googleStatus: "not_connected", lineConnected: false, errors7d: 0, reviews30d: 0, replyRate: 0, startedAt: "2025-11-01", lastActiveAt: "2026-09-30T18:00:00+09:00" },
  { id: "t10", name: "旭川やきとり 鳥政（個人）", plan: "starter", status: "active", stores: 1, googleStatus: "connected", lineConnected: true, errors7d: 0, reviews30d: 11, replyRate: 100, startedAt: "2026-06-01", lastActiveAt: "2026-10-21T08:55:00+09:00" },
  { id: "t11", name: "札幌イタリアン ルーチェ", plan: "standard", status: "active", stores: 2, googleStatus: "error", lineConnected: true, errors7d: 5, reviews30d: 28, replyRate: 64, startedAt: "2026-05-15", lastActiveAt: "2026-10-19T13:10:00+09:00" },
  { id: "t12", name: "十勝ファームキッチン", plan: "standard", status: "trial", stores: 1, googleStatus: "connected", lineConnected: true, errors7d: 0, reviews30d: 8, replyRate: 75, startedAt: "2026-10-05", lastActiveAt: "2026-10-21T12:00:00+09:00" },
];

export const TICKETS: SupportTicket[] = [
  { id: "s101", tenantId: "t11", subject: "Google連携が切れて口コミが同期されない", status: "open", priority: "high", createdAt: "2026-10-21T09:12:00+09:00" },
  { id: "s102", tenantId: "t01", subject: "カフェ店舗のGoogle再接続の方法を知りたい", status: "in_progress", priority: "high", createdAt: "2026-10-20T10:30:00+09:00" },
  { id: "s103", tenantId: "t04", subject: "LINE通知の設定方法について", status: "open", priority: "normal", createdAt: "2026-10-19T16:45:00+09:00" },
  { id: "s104", tenantId: "t06", subject: "請求書の再発行依頼", status: "in_progress", priority: "normal", createdAt: "2026-10-15T11:00:00+09:00" },
  { id: "s105", tenantId: "t03", subject: "スタッフを追加で招待したい", status: "resolved", priority: "normal", createdAt: "2026-10-10T14:20:00+09:00" },
];

/** 月次売上（円・税抜）。直近12か月。当月は契約中＋支払遅延の月額合計（見込み） */
export const MONTHLY_REVENUE = [
  { key: "2025-11", amount: 19800 },
  { key: "2025-12", amount: 49600 },
  { key: "2026-01", amount: 59400 },
  { key: "2026-02", amount: 69200 },
  { key: "2026-03", amount: 89000 },
  { key: "2026-04", amount: 118800 },
  { key: "2026-05", amount: 138600 },
  { key: "2026-06", amount: 148400 },
  { key: "2026-07", amount: 148400 },
  { key: "2026-08", amount: 158200 },
  { key: "2026-09", amount: 168200 },
  { key: "2026-10", amount: 148400 },
];
