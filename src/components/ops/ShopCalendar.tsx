import { Camera, Clapperboard } from "lucide-react";
import { addDays, fmtDate, fmtParty } from "@/lib/ops/dates";
import type { Assignment, Creator, Slot } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

/**
 * 飲食店向け：撮影・投稿のカレンダー
 * - 月のカレンダー：日ごとに「撮影○名」「投稿○件」。日付を押すと下の日別の予定へ
 * - 日別の予定：撮影は時間帯ごとに、誰が何名で来るか（同伴者込みの合計も）
 */

type Row = { a: Assignment; creator: Creator; slot: Slot };

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
const party = (a: Assignment) => a.partySize ?? 1;
const posted = (a: Assignment) => Boolean(a.postUrl || a.insight);
const dow = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getUTCDay();

function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

function Month({ ym, shoots, posts, today }: { ym: string; shoots: Map<string, number>; posts: Map<string, number>; today: string }) {
  const first = `${ym}-01`;
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(dow(first)).fill(null), ...Array.from({ length: days }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  return (
    <div>
      <p className="mb-2 text-sm font-bold">
        {y}年{m}月
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {WEEK.map((w, i) => (
          <span key={w} className={cn("pb-1 font-bold", i === 0 ? "text-rose-600" : i === 6 ? "text-sky-700" : "text-muted")}>
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const s = shoots.get(d) ?? 0;
          const p = posts.get(d) ?? 0;
          const has = s > 0 || p > 0;
          const body = (
            <>
              <span className={cn("num text-xs", d === today && "rounded-full bg-ink px-1.5 font-bold text-white")}>{Number(d.slice(8))}</span>
              {s > 0 && (
                <span className="mt-0.5 flex w-full items-center justify-center gap-0.5 whitespace-nowrap rounded bg-brand text-[10px] font-bold leading-4 text-white">
                  <Camera className="size-2.5" aria-hidden />
                  {s}名<span className="sr-only">が撮影</span>
                </span>
              )}
              {p > 0 && (
                <span className="mt-0.5 flex w-full items-center justify-center gap-0.5 whitespace-nowrap rounded bg-emerald-100 text-[10px] font-bold leading-4 text-emerald-800">
                  <Clapperboard className="size-2.5" aria-hidden />
                  {p}<span className="sr-only">件投稿</span>
                </span>
              )}
            </>
          );
          const cls = cn("flex min-h-14 flex-col items-center rounded-lg border p-0.5 pt-1", has ? "border-line bg-white" : "border-transparent bg-mist/60 text-muted", d < today && "opacity-60");
          return has ? (
            <a key={d} href={`#day-${d}`} className={cn(cls, "hover:border-brand")}>
              {body}
            </a>
          ) : (
            <span key={d} className={cls}>
              {body}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function ShopCalendar({ rows, today }: { rows: Row[]; today: string }) {
  if (rows.length === 0) return null;
  // 撮影：日付 → 時間帯 → 人
  const shootDays = new Map<string, Map<string, Row[]>>();
  for (const r of rows) {
    const byTime = shootDays.get(r.slot.date) ?? new Map<string, Row[]>();
    const key = `${r.slot.start}〜${r.slot.end}`;
    byTime.set(key, [...(byTime.get(key) ?? []), r]);
    shootDays.set(r.slot.date, byTime);
  }
  const postDays = new Map<string, Row[]>();
  for (const r of rows) if (r.a.plannedPostDate) postDays.set(r.a.plannedPostDate, [...(postDays.get(r.a.plannedPostDate) ?? []), r]);

  const shootCount = new Map([...shootDays].map(([d, t]) => [d, [...t.values()].flat().reduce((n, r) => n + party(r.a), 0)]));
  const postCount = new Map([...postDays].map(([d, list]) => [d, list.length]));
  const dates = [...new Set([...shootDays.keys(), ...postDays.keys()])].sort();
  const months = monthsBetween(dates[0].slice(0, 7), dates[dates.length - 1].slice(0, 7));

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-sm font-bold">撮影・投稿カレンダー</p>
      <p className="mt-0.5 text-xs text-muted">
        <span className="mr-1 inline-flex items-center gap-0.5 rounded bg-brand px-1 text-[10px] font-bold text-white">
          <Camera className="size-2.5" aria-hidden />
          ○名
        </span>
        撮影に来る人数（同伴者を含む）
        <span className="ml-2 mr-1 inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1 text-[10px] font-bold text-emerald-800">
          <Clapperboard className="size-2.5" aria-hidden />○
        </span>
        投稿の予定数。日付を押すと、その日の詳細へ移動します
      </p>
      <div className="mt-3 grid gap-5 md:grid-cols-2">
        {months.map((ym) => (
          <Month key={ym} ym={ym} shoots={shootCount} posts={postCount} today={today} />
        ))}
      </div>

      <p className="mt-6 text-sm font-bold">日別の予定</p>
      <ol className="mt-2 space-y-3">
        {dates.map((d) => {
          const times = [...(shootDays.get(d) ?? new Map<string, Row[]>())].sort(([a], [b]) => a.localeCompare(b));
          const ps = postDays.get(d) ?? [];
          const label = d === today ? "今日" : d === addDays(today, 1) ? "明日" : null;
          return (
            <li key={d} id={`day-${d}`} className={cn("scroll-mt-4 rounded-xl border p-3", d === today ? "border-brand/40 bg-brand/5" : "border-line", d < today && "opacity-70")}>
              <p className="flex items-center gap-2 font-bold">
                <span className="num text-base">{fmtDate(d)}</span>
                {label && <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] text-white">{label}</span>}
                {d < today && <span className="text-xs font-normal text-muted">終了</span>}
              </p>
              {times.map(([time, list]) => (
                <div key={time} className="mt-2">
                  <p className="flex items-center gap-1.5 text-sm">
                    <Camera className="size-4 text-brand" />
                    <b className="num">{time}</b>
                    <span className="text-xs text-muted">撮影・来店 計{list.reduce((n, r) => n + party(r.a), 0)}名</span>
                  </p>
                  <ul className="mt-1 space-y-0.5 pl-6 text-sm">
                    {list.map((r) => (
                      <li key={r.a.id}>
                        <b>{r.creator.name}</b>さん
                        <span className="ml-1 text-xs text-muted">{fmtParty(r.a.partySize)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {ps.length > 0 && (
                <div className="mt-2">
                  <p className="flex items-center gap-1.5 text-sm">
                    <Clapperboard className="size-4 text-emerald-700" />
                    <b>投稿</b>
                  </p>
                  <ul className="mt-1 space-y-0.5 pl-6 text-sm">
                    {ps.map((r) => (
                      <li key={r.a.id}>
                        <b>{r.creator.name}</b>さん
                        {posted(r.a) ? (
                          r.a.postUrl ? (
                            <a href={r.a.postUrl} target="_blank" rel="noopener" className="ml-1 text-xs font-bold text-emerald-700 underline">
                              投稿済み・見る
                            </a>
                          ) : (
                            <span className="ml-1 text-xs font-bold text-emerald-700">投稿済み</span>
                          )
                        ) : (
                          <span className="ml-1 text-xs text-muted">投稿予定</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
