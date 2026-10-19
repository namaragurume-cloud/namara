import type { Pickup } from "../data/types";
import { PickupCard } from "./PickupCard";

type Props = {
  pickups: Pickup[];
  now: number;
  flashIds: Set<string>;
  onRequestManualComplete: (p: Pickup) => void;
};

/** 来店予定（受取時間の早い順。受取待ちが上、完了は下にまとめてグレー表示） */
export function Timeline({ pickups, now, flashIds, onRequestManualComplete }: Props) {
  const waiting = pickups.filter((p) => p.status === "waiting").sort((a, b) => a.start - b.start);
  const done = pickups
    .filter((p) => p.status === "completed")
    .sort((a, b) => (flashIds.has(b.id) ? 1 : 0) - (flashIds.has(a.id) ? 1 : 0) || a.start - b.start);
  return (
    <section aria-label="来店予定" className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-xl font-black sm:text-2xl">来店予定</h2>
        <p className="text-base font-bold text-stone-600">
          受取待ち <span className="num text-2xl font-extrabold text-wait-ink">{waiting.length}</span> 件
        </p>
      </div>
      <ol className="-mx-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-1 pb-1 sm:gap-3 lg:grid lg:auto-rows-min lg:grid-cols-2 lg:content-start">
        {waiting.length === 0 && (
          <li className="shrink-0 rounded-3xl bg-leaf-soft px-5 py-6 text-center text-xl font-black text-brand lg:col-span-2">受取待ちはありません</li>
        )}
        {waiting.map((p) => (
          <PickupCard key={p.id} pickup={p} now={now} flash={false} onRequestManualComplete={onRequestManualComplete} />
        ))}
        {done.map((p) => (
          <PickupCard key={p.id} pickup={p} now={now} flash={flashIds.has(p.id)} onRequestManualComplete={onRequestManualComplete} />
        ))}
      </ol>
    </section>
  );
}
