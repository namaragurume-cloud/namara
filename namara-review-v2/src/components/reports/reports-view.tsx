"use client";

import { useMemo, useState } from "react";
import { FileDown, MessageSquareText, Printer, Smile, Sparkles, Star, ThumbsDown, ThumbsUp, TriangleAlert } from "lucide-react";

import { STORE_COLORS, StoreTrendChart } from "@/components/charts/store-trend-chart";
import { TopicBalance } from "@/components/charts/topic-balance";
import { Delta } from "@/components/common/delta";
import { EmptyState } from "@/components/common/empty-state";
import { KpiCard } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { StarRating } from "@/components/common/star-rating";
import { SuggestionList } from "@/components/dashboard/suggestion-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildSuggestions,
  monthKey,
  monthLabel,
  monthlyReport,
  monthlyTrend,
  percentChange,
  recentMonthKeys,
  storeComparison,
} from "@/lib/analytics";
import { DEMO_TODAY } from "@/lib/constants";
import { useAccessibleStores, useDemoState, useScopedReviews } from "@/lib/demo/store";
import { formatDate, formatPercent, formatRating } from "@/lib/format";
import { cn } from "@/lib/utils";

function endOfMonthIso(key: string) {
  if (key === monthKey(DEMO_TODAY)) return DEMO_TODAY;
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${key}-${String(last).padStart(2, "0")}T23:59:00+09:00`;
}

export function ReportsView() {
  const reviews = useScopedReviews();
  const stores = useAccessibleStores();
  const allReviews = useDemoState((s) => s.reviews);
  const selected = useDemoState((s) => s.selectedStoreId);
  const months = useMemo(() => recentMonthKeys(DEMO_TODAY, 12).reverse(), []);
  const [month, setMonth] = useState(months[0]);

  const report = useMemo(() => monthlyReport(reviews, month), [reviews, month]);
  const suggestions = useMemo(
    () => buildSuggestions(reviews, endOfMonthIso(month)).filter((s) => s.id !== "low-unreplied"),
    [reviews, month],
  );
  const comparison = useMemo(() => {
    const ids = new Set(stores.map((s) => s.id));
    return storeComparison(stores, allReviews.filter((r) => ids.has(r.storeId)), month);
  }, [stores, allReviews, month]);
  const storeTrend = useMemo(() => {
    const perStore = stores.map((s) => monthlyTrend(allReviews.filter((r) => r.storeId === s.id), endOfMonthIso(month), 6));
    return perStore[0]?.map((point, i) => {
      const row: Record<string, string | number> = { label: point.label };
      stores.forEach((s, si) => (row[s.id] = perStore[si][i].count));
      return row;
    }) ?? [];
  }, [stores, allReviews, month]);

  const mentions = report.topics.reduce((sum, t) => sum + t.positive + t.negative, 0);
  const positiveMentions = report.topics.reduce((sum, t) => sum + t.positive, 0);
  const lowCount = report.distribution.filter((d) => d.rating <= 2).reduce((sum, d) => sum + d.count, 0);
  const scopeLabel = selected === "all" ? "全店舗" : stores.find((s) => s.id === selected)?.name;
  const isCurrent = month === monthKey(DEMO_TODAY);

  const best = [...report.topics].sort((a, b) => b.positive - a.positive)[0];
  const worst = [...report.topics].sort((a, b) => b.negative - a.negative)[0];
  const countChange = percentChange(report.count, report.previousCount);
  const summary =
    report.count === 0
      ? null
      : [
          `${monthLabel(month, true)}${isCurrent ? `（${formatDate(DEMO_TODAY)}まで）` : ""}の口コミは${report.count}件${
            countChange !== null && !isCurrent ? `（前月比${countChange >= 0 ? "+" : ""}${countChange.toFixed(0)}%）` : ""
          }、平均評価は★${formatRating(report.average)}でした。`,
          best && best.positive > 0 ? `特に「${best.label}」への好意的な声が多く（${best.positive}件）、お店の強みになっています。` : "",
          worst && worst.negative > 0 ? `一方で「${worst.label}」への指摘が${worst.negative}件あり、改善の余地があります。` : "大きな不満の傾向は見られませんでした。",
        ].join("");

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI分析レポート"
        description={`${scopeLabel}・${monthLabel(month, true)}の口コミ分析`}
        actions={
          <>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-40" aria-label="対象月">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthLabel(m, true)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden />
              印刷・PDF保存
            </Button>
            <Button variant="outline" disabled title="Phase 6 で実装予定">
              <FileDown aria-hidden />
              PDF出力（準備中）
            </Button>
          </>
        }
      />

      <section aria-label="月次の主要指標" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard
          title="口コミ件数"
          value={report.count}
          unit="件"
          icon={MessageSquareText}
          footer={isCurrent ? <span className="text-xs text-muted-foreground">月途中（前月：{report.previousCount}件）</span> : <Delta label="前月比" value={countChange} />}
        />
        <KpiCard
          title="平均星評価"
          value={formatRating(report.average)}
          icon={Star}
          footer={
            <Delta
              label="前月差"
              value={report.average !== null && report.previousAverage !== null ? report.average - report.previousAverage : null}
              unit=""
              digits={2}
            />
          }
        />
        <KpiCard
          title="ポジティブ率"
          value={mentions ? formatPercent((positiveMentions / mentions) * 100) : "—"}
          icon={Smile}
          footer={<span className="text-xs text-muted-foreground">言及{mentions}件のうち好評{positiveMentions}件</span>}
        />
        <KpiCard
          title="低評価（★2以下）"
          value={lowCount}
          unit="件"
          icon={TriangleAlert}
          tone={lowCount > 0 ? "attention" : "default"}
          footer={<span className="text-xs text-muted-foreground">全体の{report.count ? ((lowCount / report.count) * 100).toFixed(0) : 0}%</span>}
        />
      </section>

      {report.count === 0 ? (
        <Card>
          <EmptyState icon={MessageSquareText} title="この月の口コミはありません" description="別の月を選択してください。" />
        </Card>
      ) : (
        <>
          <Card className="border-brand/20 bg-gradient-to-br from-brand-soft/60 to-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Sparkles className="size-4 text-brand" aria-hidden />
                AI総評
              </CardTitle>
              <CardDescription>Phase 1 では集計結果から自動で文章を作成しています（Phase 6 でOpenAIによる分析に置き換え）</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed">{summary}</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>カテゴリ別の評価</CardTitle>
                <CardDescription>料理・接客・価格・雰囲気などへの言及数</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <TopicBalance data={report.topics} />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>カテゴリ</TableHead>
                      <TableHead className="text-right">好評</TableHead>
                      <TableHead className="text-right">不満</TableHead>
                      <TableHead className="text-right">不満の前月差</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.topics.map((t) => (
                      <TableRow key={t.topic}>
                        <TableCell>{t.label}</TableCell>
                        <TableCell className="text-right tabular">{t.positive}</TableCell>
                        <TableCell className="text-right tabular">{t.negative}</TableCell>
                        <TableCell className="text-right">
                          <Delta value={t.negative - t.previousNegative} unit="件" goodWhen="down" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>改善提案</CardTitle>
                <CardDescription>対象月までの直近3か月の口コミから</CardDescription>
              </CardHeader>
              <CardContent>
                <SuggestionList suggestions={suggestions} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {(
              [
                ["positive", "ポジティブ評価の傾向", ThumbsUp, report.positiveKeywords, report.positiveQuotes],
                ["negative", "ネガティブ評価の傾向", ThumbsDown, report.negativeKeywords, report.negativeQuotes],
              ] as const
            ).map(([kind, title, Icon, keywords, quotes]) => (
              <Card key={kind}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-1.5">
                    <Icon className={cn("size-4", kind === "positive" ? "text-brand" : "text-destructive")} aria-hidden />
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {keywords.length > 0 ? (
                    <ul className="flex flex-wrap gap-1.5" aria-label="よく言及されたメニュー">
                      {keywords.map((k) => (
                        <li
                          key={k.keyword}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs",
                            kind === "positive" ? "bg-brand-soft text-brand" : "bg-destructive-soft text-destructive",
                          )}
                        >
                          {k.keyword}
                          <span className="ml-1 tabular opacity-75">{k.count}件</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {quotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">該当する口コミはありません。</p>
                  ) : (
                    <ul className="space-y-2">
                      {quotes.map((q) => (
                        <li key={q.id} className="rounded-lg bg-muted/70 p-3 text-sm">
                          <StarRating rating={q.rating} />
                          <p className="mt-1 leading-relaxed">{q.text}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {stores.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>店舗別比較</CardTitle>
            <CardDescription>{monthLabel(month, true)}・担当している全店舗</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>店舗</TableHead>
                  <TableHead className="text-right">口コミ件数</TableHead>
                  <TableHead className="text-right">前月比</TableHead>
                  <TableHead className="text-right">平均評価</TableHead>
                  <TableHead className="text-right">前月差</TableHead>
                  <TableHead className="text-right">返信率</TableHead>
                  <TableHead className="text-right">未返信</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.map((row, i) => (
                  <TableRow key={row.store.id}>
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium">
                        <span className="size-2.5 rounded-full" style={{ background: STORE_COLORS[i % 3] }} aria-hidden />
                        {row.store.shortName}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular">{row.count}件</TableCell>
                    <TableCell className="text-right">
                      {isCurrent ? <span className="text-xs text-muted-foreground">月途中</span> : <Delta value={percentChange(row.count, row.previousCount)} />}
                    </TableCell>
                    <TableCell className="text-right tabular">★{formatRating(row.average)}</TableCell>
                    <TableCell className="text-right">
                      <Delta
                        value={row.average !== null && row.previousAverage !== null ? row.average - row.previousAverage : null}
                        unit=""
                        digits={2}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular">{formatPercent(row.replyRate)}</TableCell>
                    <TableCell className={cn("text-right tabular", row.unreplied > 0 && "font-semibold text-warning")}>
                      {row.unreplied}件
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div>
              <p className="mb-2 text-sm font-medium">口コミ件数の推移（直近6か月{isCurrent ? "・今月は途中経過" : ""}）</p>
              <StoreTrendChart
                data={storeTrend}
                series={stores.slice(0, 3).map((s, i) => ({ key: s.id, name: s.shortName, color: STORE_COLORS[i] }))}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
