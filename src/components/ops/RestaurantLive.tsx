import { CalendarClock, Camera, Clapperboard } from "lucide-react";
import { addDays, fmtDate, fmtParty, fmtSlot } from "@/lib/ops/dates";
import { findSlot } from "@/lib/ops/slots";
import type { Assignment, Campaign, Creator, Slot } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

/**
 * 飲食店向け：撮影・投稿の状況（リアルタイム）。
 * 「投稿済み」は投稿URLかインサイトのスクショが届いたものだけ。投稿日を過ぎても確認できていなければ「確認中」と表示します。
 */

type Row = { a: Assignment; creator: Creator; slot: Slot };

type ShootState = { label: string; tone: "today" | "soon" | "done" | "plan" };
type PostState = { label: string; tone: "today" | "soon" | "done" | "plan" | "check" };

function shootState(slot: Slot, today: string): ShootState {
  if (slot.date === today) return { label: "本日撮影", tone: "today" };
  if (slot.date === addDays(today, 1)) return { label: "明日撮影", tone: "soon" };
  if (slot.date < today) return { label: "撮影済み", tone: "done" };
  return { label: "撮影予定", tone: "plan" };
}

function postState(a: Assignment, today: string): PostState {
  if (a.postUrl || a.insight) return { label: "投稿済み", tone: "done" };
  const d = a.plannedPostDate;
  if (!d) return { label: "投稿日調整中", tone: "plan" };
  if (d === today) return { label: "本日投稿予定", tone: "today" };
  if (d === addDays(today, 1)) return { label: "明日投稿予定", tone: "soon" };
  if (d < today) return { label: "投稿確認中", tone: "check" };
  return { label: "投稿予定", tone: "plan" };
}

const chip = {
  today: "bg-brand text-white",
  soon: "bg-amber-100 text-amber-900",
  done: "bg-emerald-100 text-emerald-800",
  plan: "bg-zinc-100 text-zinc-700",
  check: "bg-sky-100 text-sky-900",
} as const;

function Who({ c }: { c: Creator }) {
  return (
    <span>
      <b>{c.name}</b>さん
      {c.account && (
        <a href={`https://www.instagram.com/${c.account}/`} target="_blank" rel="noopener" className="ml-1 text-xs text-brand underline">
          @{c.account}
        </a>
      )}
    </span>
  );
}

export function RestaurantLive({ campaign: c, rows: all, today, updatedAt }: { campaign: Campaign; rows: { a: Assignment; creator: Creator }[]; today: string; updatedAt: string }) {
  const accepted = all.filter((r) => r.a.status === "accepted");
  const rows: Row[] = accepted
    .filter((r) => r.a.confirmedNotifiedAt && r.a.confirmedSlotId)
    .map((r) => ({ ...r, slot: findSlot(c, r.a.confirmedSlotId)! }))
    .filter((r) => r.slot)
    .sort((x, y) => `${x.slot.date}${x.slot.start}`.localeCompare(`${y.slot.date}${y.slot.start}`));
  const pending = accepted.length - rows.length;
  const tomorrow = addDays(today, 1);

  const events = [
    ...rows.filter((r) => r.slot.date === today || r.slot.date === tomorrow).map((r) => ({ key: `s${r.a.id}`, day: r.slot.date, time: r.slot.start, kind: "shoot" as const, r })),
    ...rows
      .filter((r) => !r.a.postUrl && !r.a.insight && (r.a.plannedPostDate === today || r.a.plannedPostDate === tomorrow))
      .map((r) => ({ key: `p${r.a.id}`, day: r.a.plannedPostDate!, time: "", kind: "post" as const, r })),
  ].sort((x, y) => `${x.day}${x.time}`.localeCompare(`${y.day}${y.time}`));

  const shot = rows.filter((r) => r.slot.date < today).length;
  const posted = rows.filter((r) => r.a.postUrl || r.a.insight).length;

  return (
    <section className="space-y-4 print:hidden">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-lg font-extrabold">撮影・投稿の状況</h2>
        <p className="text-xs text-muted">最終更新 {updatedAt}（自動で更新されます）</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["撮影済み", `${shot}/${rows.length}`],
          ["投稿済み", `${posted}/${rows.length}`],
          ["日程調整中", `${pending}名`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-white px-2 py-3">
            <p className="text-xs font-bold text-muted">{k}</p>
            <p className="num mt-1 text-xl font-extrabold">{v}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <p className="flex items-center gap-2 text-sm font-bold">
          <CalendarClock className="size-4 text-brand" />
          今日・明日の予定
        </p>
        {events.length === 0 ? (
          <p className="mt-2 text-sm text-muted">今日・明日の撮影や投稿の予定はありません。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {events.map((e) => (
              <li key={e.key} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3 py-2.5 text-sm", e.day === today ? "bg-brand/5 ring-1 ring-brand/30" : "bg-amber-50")}>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", e.day === today ? chip.today : chip.soon)}>{e.day === today ? "今日" : "明日"}</span>
                {e.kind === "shoot" ? (
                  <span className="flex items-center gap-1.5">
                    <Camera className="size-4 text-muted" />
                    <b className="num">{fmtSlot(e.r.slot).replace(/^\S+\s/, "")}</b>
                    <Who c={e.r.creator} />
                    {(e.r.a.partySize ?? 1) > 1 ? `ほか計${e.r.a.partySize}名` : ""}が撮影に伺います
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Clapperboard className="size-4 text-muted" />
                    <Who c={e.r.creator} />
                    が投稿予定です
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <p className="text-sm font-bold">発信者ごとの状況</p>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted">撮影日が決まりましたら、ここに表示されます。</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {rows.map((r) => {
              const s = shootState(r.slot, today);
              const p = postState(r.a, today);
              return (
                <li key={r.a.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_1.2fr_1.2fr] sm:items-center">
                  <span>
                    <Who c={r.creator} />
                    <span className="ml-1 text-xs text-muted">来店 {fmtParty(r.a.partySize)}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", chip[s.tone])}>{s.label}</span>
                    <span className="num text-xs text-muted">{fmtSlot(r.slot)}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", chip[p.tone])}>{p.label}</span>
                    {r.a.postUrl ? (
                      <a href={r.a.postUrl} target="_blank" rel="noopener" className="text-xs font-bold text-brand underline">
                        投稿を見る
                      </a>
                    ) : (
                      r.a.plannedPostDate && <span className="num text-xs text-muted">{fmtDate(r.a.plannedPostDate)}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          ※「投稿済み」は、発信者から投稿URLかインサイトが届いたものです。投稿日を過ぎて確認がとれていないものは「投稿確認中」と表示しています。
        </p>
      </div>
    </section>
  );
}
