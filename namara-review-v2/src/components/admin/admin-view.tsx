"use client";

import { useState } from "react";
import { AlertTriangle, Building2, CircleDollarSign, Copy, Hourglass, LifeBuoy, Plus, Search, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { RevenueChart } from "@/components/charts/revenue-chart";
import { EmptyState } from "@/components/common/empty-state";
import { IntegrationBadge } from "@/components/common/integration-badge";
import { KpiCard } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { percentChange } from "@/lib/analytics";
import { PLANS } from "@/lib/constants";
import { MONTHLY_REVENUE, TENANTS, TICKETS, type ContractStatus, type Tenant, type TicketStatus } from "@/lib/demo/admin-data";
import { useDemoState } from "@/lib/demo/store";
import { organizationPath } from "@/lib/organizations";
import type { DemoState } from "@/lib/demo/reducer";
import { Button } from "@/components/ui/button";
import { CreateOrganizationDialog } from "./create-organization-dialog";
import { Delta } from "@/components/common/delta";
import { formatDate, formatRelative, formatYen } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/constants";

const CONTRACT_LABELS: Record<ContractStatus, { label: string; variant: "success" | "brand" | "warning" | "secondary" }> = {
  active: { label: "契約中", variant: "success" },
  trial: { label: "無料トライアル", variant: "brand" },
  past_due: { label: "支払い遅延", variant: "warning" },
  cancelled: { label: "解約", variant: "secondary" },
};

const TICKET_LABELS: Record<TicketStatus, string> = {
  open: "未対応",
  in_progress: "対応中",
  resolved: "解決済み",
};

/**
 * デモで実際に動いている法人（専用ページあり）を、運営画面の契約データの形に集計する。
 * Phase 6 ではサーバー側の集計クエリに置き換える。
 */
function summarizeOrganizations(state: Pick<DemoState, "organizations" | "stores" | "reviews" | "members">): Tenant[] {
  const since = new Date(DEMO_TODAY).getTime() - 30 * 86400000;
  return state.organizations.map((org) => {
    const stores = state.stores.filter((s) => s.organizationId === org.id);
    const storeIds = new Set(stores.map((s) => s.id));
    const reviews = state.reviews.filter((r) => storeIds.has(r.storeId));
    const recent = reviews.filter((r) => new Date(r.createdAt).getTime() >= since);
    const members = state.members.filter((m) => m.organizationId === org.id);
    const sample = TENANTS.find((t) => t.slug === org.slug);
    return {
      id: org.id,
      slug: org.slug,
      name: org.name,
      plan: org.plan,
      status: org.contractStatus,
      stores: stores.length,
      googleStatus: stores.some((s) => s.googleStatus === "error")
        ? "error"
        : stores.length > 0 && stores.every((s) => s.googleStatus === "connected")
          ? "connected"
          : "not_connected",
      lineConnected: stores.some((s) => s.lineStatus === "connected"),
      errors7d: reviews.filter((r) => r.status === "failed").length,
      reviews30d: recent.length,
      replyRate: reviews.length ? Math.round((reviews.filter((r) => r.status === "published").length / reviews.length) * 100) : 0,
      startedAt: sample?.startedAt ?? DEMO_TODAY.slice(0, 10),
      lastActiveAt: members.map((m) => m.lastActiveAt).sort().at(-1) ?? DEMO_TODAY,
    };
  });
}

export function AdminView() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ContractStatus | "all">("all");
  const [tickets, setTickets] = useState(TICKETS);
  const [creating, setCreating] = useState(false);
  const organizations = useDemoState((s) => s.organizations);
  const stores = useDemoState((s) => s.stores);
  const reviews = useDemoState((s) => s.reviews);
  const members = useDemoState((s) => s.members);
  // 専用ページを持つ法人（デモで操作できる）＋ サンプルの契約データ
  const allTenants = [
    ...summarizeOrganizations({ organizations, stores, reviews, members }),
    ...TENANTS.filter((t) => !t.slug),
  ];

  async function copyUrl(slug: string) {
    const url = `${window.location.origin}${organizationPath(slug)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("専用ページのURLをコピーしました", { description: url });
    } catch {
      toast(url);
    }
  }

  const paying = allTenants.filter((t) => t.status === "active" || t.status === "past_due");
  const mrr = paying.reduce((sum, t) => sum + PLANS[t.plan].price, 0);
  const storeCount = allTenants.filter((t) => t.status !== "cancelled").reduce((sum, t) => sum + t.stores, 0);
  const trials = allTenants.filter((t) => t.status === "trial").length;
  const cancelled = allTenants.filter((t) => t.status === "cancelled").length;
  const googleErrors = allTenants.filter((t) => t.googleStatus === "error").length;
  const prevRevenue = MONTHLY_REVENUE[MONTHLY_REVENUE.length - 2].amount;

  const q = query.trim().toLowerCase();
  const filtered = allTenants.filter((t) => (status === "all" || t.status === status) && (!q || t.name.toLowerCase().includes(q)));

  const tenantName = (id: string) => TENANTS.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="運営ダッシュボード"
        description="契約法人の専用ページ発行・利用状況・連携エラー・売上・サポートを管理します。"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            法人の専用ページを発行
          </Button>
        }
      />

      <section aria-label="運営の主要指標" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <KpiCard title="契約店舗数" value={storeCount} unit="店舗" icon={Building2} footer={<span className="text-xs text-muted-foreground">{allTenants.length - cancelled}社</span>} />
        <KpiCard title="月額売上（MRR）" value={formatYen(mrr)} icon={CircleDollarSign} footer={<Delta label="前月比" value={percentChange(mrr, prevRevenue)} />} />
        <KpiCard title="無料トライアル" value={trials} unit="社" icon={Hourglass} />
        <KpiCard title="解約" value={cancelled} unit="社" icon={UserMinus} footer={<span className="text-xs text-muted-foreground">累計</span>} />
        <KpiCard title="Google連携エラー" value={googleErrors} unit="社" icon={AlertTriangle} tone={googleErrors ? "attention" : "default"} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader>
            <CardTitle>売上推移</CardTitle>
            <CardDescription>月次・税抜（当月は見込み）</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={MONTHLY_REVENUE} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>プラン別の契約数</CardTitle>
            <CardDescription>解約を除く</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {(Object.keys(PLANS) as (keyof typeof PLANS)[]).map((id) => {
                const count = allTenants.filter((t) => t.plan === id && t.status !== "cancelled").length;
                return (
                  <li key={id} className="flex items-center justify-between rounded-lg border p-3">
                    <span>
                      <span className="block text-sm font-semibold">{PLANS[id].name}</span>
                      <span className="text-xs text-muted-foreground">{formatYen(PLANS[id].price)} / 月（仮）</span>
                    </span>
                    <span className="text-xl font-bold text-primary tabular">
                      {count}
                      <span className="ml-0.5 text-xs font-normal text-muted-foreground">社</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>契約一覧</CardTitle>
            <CardDescription>{filtered.length}社</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="企業・店舗名で検索" className="pl-9 sm:w-60" aria-label="契約を検索" />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as ContractStatus | "all")}>
              <SelectTrigger className="sm:w-44" aria-label="契約状況">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての契約状況</SelectItem>
                {(Object.keys(CONTRACT_LABELS) as ContractStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {CONTRACT_LABELS[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        {filtered.length === 0 ? (
          <EmptyState icon={Search} title="該当する契約がありません" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>企業・店舗</TableHead>
                <TableHead>専用ページ</TableHead>
                <TableHead>プラン</TableHead>
                <TableHead>契約状況</TableHead>
                <TableHead className="text-right">店舗数</TableHead>
                <TableHead>Google連携</TableHead>
                <TableHead className="text-right">エラー(7日)</TableHead>
                <TableHead className="text-right">口コミ(30日)</TableHead>
                <TableHead className="text-right">返信率</TableHead>
                <TableHead>最終利用</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <span className="block font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">開始 {formatDate(`${t.startedAt}T00:00:00+09:00`)}</span>
                  </TableCell>
                  <TableCell>
                    {t.slug ? (
                      <span className="inline-flex items-center gap-1">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{organizationPath(t.slug)}</code>
                        <Button size="icon-sm" variant="ghost" aria-label={`${t.name}の専用ページURLをコピー`} onClick={() => copyUrl(t.slug!)}>
                          <Copy />
                        </Button>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">サンプル</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{PLANS[t.plan].name}</TableCell>
                  <TableCell>
                    <Badge variant={CONTRACT_LABELS[t.status].variant}>{CONTRACT_LABELS[t.status].label}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular">{t.stores}</TableCell>
                  <TableCell>
                    <IntegrationBadge status={t.googleStatus} />
                  </TableCell>
                  <TableCell className={t.errors7d > 0 ? "text-right font-semibold text-destructive tabular" : "text-right tabular"}>{t.errors7d}</TableCell>
                  <TableCell className="text-right tabular">{t.reviews30d}</TableCell>
                  <TableCell className="text-right tabular">{t.reviews30d ? `${t.replyRate}%` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatRelative(t.lastActiveAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CreateOrganizationDialog key={String(creating)} open={creating} onOpenChange={setCreating} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <LifeBuoy className="size-4 text-brand" aria-hidden />
            サポート対応状況
          </CardTitle>
          <CardDescription>
            未対応 {tickets.filter((t) => t.status === "open").length}件・対応中 {tickets.filter((t) => t.status === "in_progress").length}件
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>受付日時</TableHead>
              <TableHead>企業・店舗</TableHead>
              <TableHead>内容</TableHead>
              <TableHead>優先度</TableHead>
              <TableHead>状況</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id}>
                <TableCell className="text-xs text-muted-foreground">{formatRelative(ticket.createdAt)}</TableCell>
                <TableCell className="text-xs">{tenantName(ticket.tenantId)}</TableCell>
                <TableCell className="max-w-72 whitespace-normal text-sm">{ticket.subject}</TableCell>
                <TableCell>{ticket.priority === "high" ? <Badge variant="destructive">高</Badge> : <Badge variant="secondary">通常</Badge>}</TableCell>
                <TableCell>
                  <Select
                    value={ticket.status}
                    onValueChange={(v) => setTickets((list) => list.map((t) => (t.id === ticket.id ? { ...t, status: v as TicketStatus } : t)))}
                  >
                    <SelectTrigger className="h-8 w-28 text-xs" aria-label={`${ticket.subject}の対応状況`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TICKET_LABELS) as TicketStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {TICKET_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
