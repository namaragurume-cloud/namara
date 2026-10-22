"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck, CalendarCheck, MapPin, Utensils } from "lucide-react";
import { areaLabel, genreLabel } from "@/lib/shared/dictionaries";
import type { PublicSearchOutcome } from "@/lib/shared/public";

type Organic = PublicSearchOutcome["results"][number];
type Sponsored = NonNullable<PublicSearchOutcome["sponsored"]>;

const track = (t: "detail" | "map" | "reservation", searchId: string, storeId: string, pos: number) =>
  `/api/r?${new URLSearchParams({ t, s: searchId, store: storeId, pos: String(pos) }).toString()}`;

function PhotoPlaceholder() {
  return (
    <div className="flex aspect-[4/3] w-24 shrink-0 flex-col items-center justify-center rounded-lg bg-blue-soft text-navy sm:w-28" aria-hidden>
      <Utensils className="size-6" />
      <span className="mt-1 text-[10px] text-muted">写真未登録</span>
    </div>
  );
}

export function OrganicStoreCard({ item, searchId }: { item: Organic; searchId: string }) {
  const { store } = item;
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function save() {
    setSaveError(false);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "store_saved", searchId, storeId: store.id, dedupeKey: crypto.randomUUID() }),
    }).catch(() => null);
    if (res?.ok) setSaved(true);
    else setSaveError(true);
  }

  return (
    <article className="rounded-xl border border-line bg-paper p-4 shadow-sm">
      <div className="flex gap-3">
        <PhotoPlaceholder />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted">おすすめ {item.rank}</p>
          <h3 className="font-bold leading-snug text-ink">{store.name}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {areaLabel(store.areaId)}｜{store.genreIds.map(genreLabel).join("・")}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-sm">
        <dt className="text-muted">予算目安</dt>
        <dd>
          {item.budgetText}
          <span className="block text-xs text-muted">根拠：{item.budgetBasis}</span>
        </dd>
        <dt className="text-muted">営業時間</dt>
        <dd>{store.hours ?? "不明"}</dd>
        <dt className="text-muted">予約</dt>
        <dd>{store.reservationUrl ? "予約ページあり（空席は未確認）" : "不明"}</dd>
      </dl>

      {item.reasons.some((r) => r.points > 0) && (
        <div className="mt-3 rounded-lg bg-blue-soft px-3 py-2">
          <p className="text-xs font-bold text-navy">条件に合う理由</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {item.reasons
              .filter((r) => r.points > 0)
              .map((r) => (
                <li key={r.code + r.label} className="rounded-full bg-paper px-2 py-0.5 text-xs text-navy">
                  {r.label}
                </li>
              ))}
          </ul>
        </div>
      )}
      {item.warnings.length > 0 && <p className="mt-2 text-xs text-ad">※ {item.warnings.join(" ")}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <a href={track("detail", searchId, store.id, item.rank)} className="rounded-lg bg-navy px-3 py-2 text-sm font-bold text-white hover:bg-navy-dark">
          詳細を見る
        </a>
        <a href={track("map", searchId, store.id, item.rank)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm hover:border-blue">
          <MapPin className="size-4" aria-hidden />
          地図
        </a>
        {store.reservationUrl && (
          <a href={track("reservation", searchId, store.id, item.rank)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm hover:border-blue">
            <CalendarCheck className="size-4" aria-hidden />
            予約ページ
          </a>
        )}
        <button type="button" onClick={save} disabled={saved} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm hover:border-blue disabled:opacity-60">
          {saved ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
          {saved ? "保存しました" : "保存"}
        </button>
      </div>
      {saveError && <p className="mt-1 text-xs text-bad">保存できませんでした。時間をおいてお試しください。</p>}
    </article>
  );
}

export function SponsoredStoreCard({ item }: { item: Sponsored }) {
  const { store } = item;
  return (
    <article className="rounded-xl border-2 border-amber-300 bg-ad-soft p-4" aria-label="広告">
      <p className="inline-flex items-center rounded bg-ad px-2 py-0.5 text-xs font-bold text-white">広告（スポンサー）</p>
      <p className="mt-1 text-[11px] text-amber-900">掲載料を受け取って表示している枠です。上のおすすめ順位には影響しません。</p>
      <div className="mt-2 flex gap-3">
        <PhotoPlaceholder />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold leading-snug text-ink">{store.name}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {areaLabel(store.areaId)}｜{store.genreIds.map(genreLabel).join("・")}
          </p>
          <p className="mt-1 text-sm">予算目安：{item.budgetText}</p>
          <p className="text-xs text-muted">表示理由：{item.matchReasons.join("／")}</p>
        </div>
      </div>
      <a href={`/api/r/ad?${new URLSearchParams({ imp: item.impressionId }).toString()}`} className="mt-3 inline-block rounded-lg border border-amber-400 bg-paper px-3 py-2 text-sm font-bold text-ad hover:bg-amber-50">
        詳細を見る（広告）
      </a>
    </article>
  );
}
