import { Eye, Heart, Lightbulb, Target, Trophy, Users } from "lucide-react";
import type { ReactNode } from "react";
import { fmtDate } from "@/lib/ops/dates";
import { lines, parseProposals, pct, pct1, sec, type PlatformAgg, type PostRow, type Report } from "@/lib/ops/report";
import type { Campaign, Platform, Restaurant } from "@/lib/ops/types";
import { HBars, InlineBar, Kpi, Legend, PLATFORM_COLOR, Panel, PlatformTag, ShareBar, Slide, Columns, compact } from "./parts";

const num = (n?: number) => (n === undefined ? "-" : Math.round(n).toLocaleString("ja-JP"));
const PLATFORM_NAME: Record<Platform, string> = { instagram: "Instagram", tiktok: "TikTok" };
const ROWS_PER_TABLE = 6;

function chunk<T>(list: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out.length ? out : [[]];
}

function who(r: PostRow) {
  return (
    <>
      <b className="block truncate">{r.creator.account ? `@${r.creator.account}` : r.creator.name}</b>
      <span className="block truncate text-[11px] text-muted">
        {r.creator.name}
        {r.a.plannedPostDate ? `・${fmtDate(r.a.plannedPostDate)}投稿` : ""}
      </span>
    </>
  );
}

function Rank({ n }: { n: number }) {
  const bg = n === 1 ? "#c9a227" : n === 2 ? "#8a96a8" : n === 3 ? "#a8693f" : "#eef1f5";
  return (
    <span className="num flex size-7 items-center justify-center rounded-md text-xs font-bold" style={{ background: bg, color: n <= 3 ? "#fff" : "#4a5b70" }}>
      {n}
    </span>
  );
}

export function ReportSlides({ campaign: c, restaurant, report: r }: { campaign: Campaign; restaurant: Restaurant | null; report: Report }) {
  const title = `${c.title} インサイトレポート`;
  const platforms = (["instagram", "tiktok"] as const).filter((p) => r.byPlatform[p]);
  const both = platforms.length === 2;
  const findings = lines(c.reportFindings);
  const proposals = parseProposals(c.reportProposals);
  const hasAudience = r.age.length > 0 || r.gender.length > 0;

  // ページを組み立ててから通し番号を振る
  const pages: ((page: number, total: number) => ReactNode)[] = [];

  /* 1. 表紙 */
  pages.push((page, total) => {
    const kpis: { label: string; value: ReactNode; sub?: string }[] = [
      { label: "閲覧数・再生数", value: num(r.views), sub: `${r.submitted}投稿・1投稿平均 ${num(r.views / Math.max(1, r.submitted))}` },
    ];
    if (r.reactions) kpis.push({ label: "エンゲージメント率", value: pct(r.er), sub: `反応数 ${num(r.reactions)}` });
    if (r.saves) kpis.push({ label: "保存数", value: num(r.saves), sub: "「行きたい」の目安" });
    if (r.shares) kpis.push({ label: "シェア数", value: num(r.shares), sub: "友だちへの共有" });
    if (r.nonFollowerPct !== undefined) kpis.push({ label: "フォロワー以外", value: pct1(r.nonFollowerPct), sub: "新しい層への到達" });
    if (r.byPlatform.instagram && r.follows) kpis.push({ label: "フォロー増加", value: `+${num(r.follows)}`, sub: "Instagram投稿経由" });
    return (
      <Slide key="cover" page={page} total={total} title={title}>
        <div className="grid h-full grid-rows-[auto_1fr] gap-6">
          <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-sm text-muted">{restaurant?.name} 御中</p>
              <h1 className="mt-2 text-3xl font-extrabold leading-tight text-[#14213a] md:text-[2.4rem]">
                {c.title}
                <br />
                インサイトレポート
              </h1>
              {r.period && (
                <p className="mt-4 inline-block border-b-4 border-[#cfdcf0] pb-1 text-base font-bold">対象期間：{r.period}</p>
              )}
            </div>
            {c.reportComment && (
              <div className="self-start overflow-hidden rounded-xl border border-[#d5e1f2] bg-[#f4f8fd]">
                <p className="inline-block bg-[#1f5fbf] px-5 py-1.5 text-sm font-bold text-white">サマリー</p>
                <p className="whitespace-pre-wrap p-4 text-sm leading-relaxed">{c.reportComment}</p>
              </div>
            )}
          </div>
          <div className="flex min-h-0 flex-col">
            <p className="mb-3 flex items-center gap-2 border-b border-[#e3e9f2] pb-2 text-lg font-extrabold">
              主要KPI <span className="text-xs font-normal text-muted">（キャンペーン合計）</span>
            </p>
            <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-[repeat(var(--n),minmax(0,1fr))]" style={{ "--n": kpis.length } as React.CSSProperties}>
              {kpis.map((k) => (
                <Kpi key={k.label} {...k} />
              ))}
            </div>
          </div>
        </div>
      </Slide>
    );
  });

  /* 2. 全体の結果 */
  pages.push((page, total) => {
    const breakdown = [
      { label: "いいね", value: r.likes },
      { label: "保存", value: r.saves },
      { label: "シェア", value: r.shares },
      { label: "コメント", value: r.comments },
    ].filter((x) => x.value > 0);
    return (
      <Slide key="overview" page={page} total={total} title={title}>
        <div className="grid h-full gap-4 md:grid-rows-[1.15fr_1fr]">
          <div className="grid min-h-0 gap-4 md:grid-cols-[1.4fr_1fr_1fr]">
            <Panel
              title="投稿別の閲覧数"
              icon={<Eye className="size-4" />}
              aside={both ? <Legend items={platforms.map((p) => ({ label: PLATFORM_NAME[p], color: PLATFORM_COLOR[p] }))} /> : undefined}
            >
              <Columns
                rows={r.posts.slice(0, 12).map((p) => ({
                  key: p.a.id,
                  label: p.creator.name,
                  value: p.views ?? 0,
                  color: PLATFORM_COLOR[p.platform ?? "instagram"],
                  tip: `${p.creator.name}（${PLATFORM_NAME[p.platform ?? "instagram"]}）：${num(p.views)}回`,
                }))}
              />
            </Panel>
            {both ? (
              <Panel title="媒体別の閲覧数">
                <ShareBar parts={platforms.map((p) => ({ label: PLATFORM_NAME[p], value: r.byPlatform[p]!.views, color: PLATFORM_COLOR[p] }))} />
              </Panel>
            ) : (
              <Panel title="見てくれた人" icon={<Users className="size-4" />}>
                <div className="space-y-4">
                  <Big label="フォロワー以外の割合" value={pct1(r.nonFollowerPct)} />
                  {r.byPlatform.tiktok?.newViewerPct !== undefined && <Big label="新しい視聴者の割合" value={pct1(r.byPlatform.tiktok.newViewerPct)} />}
                  <Big label="1投稿あたりの閲覧数" value={num(r.views / Math.max(1, r.submitted))} />
                </div>
              </Panel>
            )}
            <Panel title="反応の内訳" icon={<Heart className="size-4" />}>
              {breakdown.length ? <HBars rows={breakdown} format={num} /> : <p className="text-sm text-muted">データがありません</p>}
            </Panel>
          </div>
          {r.top.length > 0 && (
            <div className="flex min-h-0 flex-col">
              <p className="mb-2 flex items-center gap-2 text-lg font-extrabold">
                <Trophy className="size-5 text-[#c9a227]" />
                人気投稿 TOP{r.top.length}
                <span className="ml-auto text-[11px] font-normal text-muted">※反応数（いいね・コメント・保存・シェアの合計）で算出</span>
              </p>
              <div className="grid flex-1 gap-3 md:grid-cols-3">
                {r.top.map((p, i) => (
                  <div key={p.a.id} className="flex overflow-hidden rounded-xl border border-[#e3e9f2]">
                    <div className="flex w-[38%] flex-col justify-between p-3 text-white" style={{ background: PLATFORM_COLOR[p.platform ?? "instagram"] }}>
                      <span className="text-xs font-bold">{i + 1}位</span>
                      <span>
                        <span className="block text-[11px]">{PLATFORM_NAME[p.platform ?? "instagram"]}</span>
                        <span className="num block text-2xl font-extrabold leading-tight">{compact(p.views)}</span>
                        <span className="block text-[11px]">閲覧数</span>
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 p-3 text-xs">
                      {who(p)}
                      <dl className="mt-2 space-y-1">
                        {(
                          [
                            ["いいね", p.insight?.metrics.likes],
                            ["保存", p.insight?.metrics.saves],
                            ["シェア", p.insight?.metrics.shares],
                          ] as const
                        ).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <dt className="text-muted">{k}</dt>
                            <dd className="num font-bold">{num(v)}</dd>
                          </div>
                        ))}
                        <div className="flex justify-between border-t border-line pt-1">
                          <dt className="text-muted">反応数</dt>
                          <dd className="num text-base font-extrabold text-[#1f5fbf]">{num(p.reactions)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Slide>
    );
  });

  /* 3. 見てくれた人の属性 */
  if (hasAudience) {
    pages.push((page, total) => (
      <Slide key="audience" page={page} total={total} title={title}>
        <h2 className="mb-4 text-2xl font-extrabold">見てくれた人の属性</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Panel title="年齢" aside="閲覧数で加重平均">
            <HBars rows={r.age.map((a) => ({ label: a.label, value: a.pct }))} format={(v) => `${v.toFixed(1)}%`} />
          </Panel>
          <div className="grid gap-4">
            <Panel title="性別">
              <HBars rows={r.gender.map((g) => ({ label: g.label, value: g.pct }))} format={(v) => `${v.toFixed(1)}%`} max={100} />
            </Panel>
            <Panel title="フォロワー以外への到達">
              <div className="space-y-3">
                <Big label="フォロワー以外の割合" value={pct1(r.nonFollowerPct)} />
                {r.byPlatform.tiktok?.newViewerPct !== undefined && <Big label="TikTok 新しい視聴者の割合" value={pct1(r.byPlatform.tiktok.newViewerPct)} />}
              </div>
            </Panel>
          </div>
          {r.byPlatform.instagram?.sources.length ? (
            <Panel title="Instagram 閲覧数の上位のソース">
              <HBars rows={r.byPlatform.instagram.sources.slice(0, 6).map((s) => ({ label: s.label, value: s.pct }))} format={(v) => `${v.toFixed(1)}%`} />
            </Panel>
          ) : (
            <div />
          )}
        </div>
        <p className="mt-3 text-[11px] text-muted">※ 各投稿の割合を閲覧数で重み付けして合算しています。年齢の区切りは媒体の違いをそろえるため「55+」にまとめています。</p>
      </Slide>
    ));
  }

  /* 4〜. 媒体ごと */
  for (const p of platforms) {
    const agg = r.byPlatform[p]!;
    pages.push((page, total) => <PlatformSummary key={`${p}-sum`} page={page} total={total} title={title} agg={agg} shareOfViews={r.views ? agg.views / r.views : undefined} />);
    chunk(agg.posts, ROWS_PER_TABLE).forEach((rows, i, all) =>
      pages.push((page, total) => (
        <PlatformTable key={`${p}-table-${i}`} page={page} total={total} title={title} agg={agg} rows={rows} offset={i * ROWS_PER_TABLE} last={i === all.length - 1} />
      )),
    );
  }

  /* 考察・提案 */
  if (findings.length || proposals.length) {
    pages.push((page, total) => (
      <Slide key="findings" page={page} total={total} title={title}>
        <div className="grid h-full gap-6 md:grid-cols-2">
          <div className="flex min-h-0 flex-col">
            <h2 className="mb-3 flex items-center gap-2 border-b border-[#e3e9f2] pb-2 text-2xl font-extrabold">
              <Lightbulb className="size-6 text-[#1f5fbf]" />
              考察
            </h2>
            <ul className="flex-1 space-y-4 rounded-xl border border-[#e3e9f2] bg-[#f4f8fd] p-5 text-sm leading-relaxed">
              {findings.map((f) => (
                <li key={f} className="flex gap-3">
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-[#1f5fbf]" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          {proposals.length > 0 && (
            <div className="flex min-h-0 flex-col">
              <h2 className="mb-3 flex items-center gap-2 border-b border-[#e3e9f2] pb-2 text-2xl font-extrabold">
                <Target className="size-6 text-[#1f5fbf]" />
                次回施策のご提案
              </h2>
              <ol className="flex flex-1 flex-col gap-3">
                {proposals.slice(0, 4).map((x, i) => (
                  <li key={x.title} className="flex flex-1 items-center gap-4 rounded-xl border border-[#e3e9f2] bg-[#f4f8fd] p-4">
                    <span className="num flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#1f5fbf] text-lg font-extrabold text-white">{i + 1}</span>
                    <span>
                      <b className="block text-base">{x.title}</b>
                      {x.body && <span className="mt-1 block text-xs leading-relaxed text-muted">{x.body}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </Slide>
    ));
  }

  return <div className="space-y-6 print:space-y-0">{pages.map((render, i) => render(i + 1, pages.length))}</div>;
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="num text-3xl font-extrabold text-[#14213a]">{value}</p>
    </div>
  );
}

function PlatformSummary({ page, total, title, agg, shareOfViews }: { page: number; total: number; title: string; agg: PlatformAgg; shareOfViews?: number }) {
  const ig = agg.platform === "instagram";
  const n = agg.posts.length;
  const kpis = ig
    ? [
        { label: "閲覧数", value: num(agg.views), sub: `1投稿平均 ${num(agg.views / n)}` },
        { label: "閲覧者", value: num(agg.viewers), sub: "各投稿の合計" },
        { label: "平均再生時間", value: sec(agg.avgWatchSec), sub: "動画投稿の平均" },
        { label: "フォロー数", value: `+${num(agg.follows)}`, sub: "投稿経由の新規" },
      ]
    : [
        { label: "総視聴数", value: num(agg.views), sub: `1投稿平均 ${num(agg.views / n)}` },
        { label: "エンゲージメント率", value: pct(agg.er), sub: `反応数 ${num(agg.reactions)}` },
        { label: "新しい視聴者", value: pct1(agg.newViewerPct), sub: "初めて見た人の割合" },
        { label: "非フォロワー", value: pct1(agg.nonFollowerPct), sub: "フォロワー以外の割合" },
      ];
  const breakdown = [
    { label: "いいね", value: agg.likes },
    { label: ig ? "保存" : "保存（お気に入り）", value: agg.saves },
    { label: "シェア", value: agg.shares },
    { label: "コメント", value: agg.comments },
  ];
  return (
    <Slide page={page} total={total} title={title}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <PlatformTag platform={agg.platform} />
          <h2 className="mt-2 text-3xl font-extrabold">{PLATFORM_NAME[agg.platform]} サマリー</h2>
        </div>
        <p className="text-sm text-muted">
          {n}投稿{shareOfViews !== undefined && shareOfViews < 1 ? `・全体の閲覧数の${(shareOfViews * 100).toFixed(0)}%` : ""}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title="反応の内訳" icon={<Heart className="size-4" />} aside={agg.hasReactions ? `ER ${pct(agg.er)}` : undefined}>
          {agg.hasReactions ? <HBars rows={breakdown} format={num} /> : <p className="text-sm text-muted">スクショに写っていなかったため集計していません</p>}
        </Panel>
        {ig ? (
          <Panel title="閲覧数の上位のソース" aside="閲覧数で加重平均">
            {agg.sources.length ? <HBars rows={agg.sources.slice(0, 5).map((s) => ({ label: s.label, value: s.pct }))} format={(v) => `${v.toFixed(1)}%`} /> : <p className="text-sm text-muted">データがありません</p>}
          </Panel>
        ) : (
          <Panel title="投稿別の閲覧数">
            <HBars rows={agg.posts.map((p) => ({ label: p.creator.account ? `@${p.creator.account}` : p.creator.name, value: p.views ?? 0 }))} format={num} color={PLATFORM_COLOR.tiktok} />
          </Panel>
        )}
      </div>
    </Slide>
  );
}

function PlatformTable({ page, total, title, agg, rows, offset, last }: { page: number; total: number; title: string; agg: PlatformAgg; rows: PostRow[]; offset: number; last: boolean }) {
  const ig = agg.platform === "instagram";
  const max = Math.max(...agg.posts.map((p) => p.views ?? 0), 1);
  const bestEr = Math.max(...agg.posts.map((p) => p.er ?? -1));
  type Col = { h: string; v: (p: PostRow) => string; total: string };
  const m = (p: PostRow, k: keyof NonNullable<PostRow["insight"]>["metrics"]) => p.insight?.metrics[k];
  const cols: Col[] = ig
    ? [
        { h: "閲覧者", v: (p) => num(m(p, "viewers")), total: num(agg.viewers) },
        { h: "平均再生", v: (p) => sec(m(p, "avgWatchSec")), total: sec(agg.avgWatchSec) },
        { h: "フォロー", v: (p) => num(m(p, "follows")), total: num(agg.follows) },
        { h: "フォロワー外", v: (p) => pct1(m(p, "nonFollowerPct")), total: pct1(agg.nonFollowerPct) },
        { h: "いいね", v: (p) => num(m(p, "likes")), total: agg.hasReactions ? num(agg.likes) : "-" },
        { h: "保存", v: (p) => num(m(p, "saves")), total: agg.hasReactions ? num(agg.saves) : "-" },
      ]
    : [
        { h: "いいね", v: (p) => num(m(p, "likes")), total: num(agg.likes) },
        { h: "コメント", v: (p) => num(m(p, "comments")), total: num(agg.comments) },
        { h: "シェア", v: (p) => num(m(p, "shares")), total: num(agg.shares) },
        { h: "保存", v: (p) => num(m(p, "saves")), total: num(agg.saves) },
        { h: "新規視聴者", v: (p) => pct1(m(p, "newViewerPct")), total: pct1(agg.newViewerPct) },
        { h: "非フォロワー", v: (p) => pct1(m(p, "nonFollowerPct")), total: pct1(agg.nonFollowerPct) },
      ];
  return (
    <Slide page={page} total={total} title={title}>
      <div className="mb-4 flex items-center gap-3 border-b border-[#e3e9f2] pb-3">
        <PlatformTag platform={agg.platform} />
        <h2 className="text-2xl font-extrabold">投稿別の結果</h2>
        <span className="text-xs text-muted">（閲覧数の多い順）</span>
      </div>
      <div className="-mx-6 overflow-x-auto md:mx-0">
        <table className="w-full min-w-[860px] overflow-hidden rounded-xl text-sm">
          <thead className="bg-[#f1f5fb] text-left text-xs">
            <tr>
              <th className="w-12 px-3 py-2.5">順位</th>
              <th className="px-2 py-2.5">発信者</th>
              <th className="px-2 py-2.5" colSpan={2}>
                {ig ? "閲覧数" : "総視聴数"}
              </th>
              {cols.map((c) => (
                <th key={c.h} className="px-2 py-2.5 text-right">
                  {c.h}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right">ER</th>
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((p, i) => (
              <tr key={p.a.id} className="border-b border-[#eef1f5]">
                <td className="px-3 py-3">
                  <Rank n={offset + i + 1} />
                </td>
                <td className="max-w-44 px-2 py-3 font-sans">{who(p)}</td>
                <td className="w-36 px-2 py-3">
                  <InlineBar value={p.views} max={max} color={PLATFORM_COLOR[agg.platform]} />
                </td>
                <td className="w-20 px-2 py-3 text-right font-bold">{num(p.views)}</td>
                {cols.map((c) => (
                  <td key={c.h} className="px-2 py-3 text-right">
                    {c.v(p)}
                  </td>
                ))}
                <td className={`px-3 py-3 text-right font-bold ${p.er !== undefined && p.er === bestEr && agg.posts.length > 1 ? "text-[#1f5fbf]" : ""}`}>{pct(p.er)}</td>
              </tr>
            ))}
          </tbody>
          {last && (
            <tfoot className="num bg-[#1f5fbf] text-white">
              <tr>
                <td />
                <td className="px-2 py-3 font-sans font-bold">合計（{agg.posts.length}投稿）</td>
                <td />
                <td className="px-2 py-3 text-right font-bold">{num(agg.views)}</td>
                {cols.map((c) => (
                  <td key={c.h} className="px-2 py-3 text-right font-bold">
                    {c.total}
                  </td>
                ))}
                <td className="px-3 py-3 text-right font-bold">{pct(agg.er)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-3 text-[11px] text-muted">
        ER＝（いいね＋コメント＋保存＋シェア）÷ 閲覧数。{ig ? "平均再生時間・フォロワー外の合計欄は平均値。" : "割合の合計欄は閲覧数で加重平均。"}
        {agg.posts.length > 1 ? "最もERが高い投稿を青字で表示しています。" : ""}「-」はスクショに写っていなかった項目です。
      </p>
    </Slide>
  );
}

