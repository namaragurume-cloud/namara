"use client";

import { useMemo, useState } from "react";
import { followerScales, type Creator } from "@/data/creators";
import { cn } from "@/lib/utils";
import { CreatorCard } from "@/components/ui/CreatorCard";

/** 絞り込みを表示する最低掲載人数 */
const FILTER_THRESHOLD = 6;

export function CreatorList({ creators }: { creators: Creator[] }) {
  const [area, setArea] = useState("");
  const [genre, setGenre] = useState("");
  const [scale, setScale] = useState("");

  const areas = useMemo(() => [...new Set(creators.flatMap((c) => c.areas))], [creators]);
  const genres = useMemo(() => [...new Set(creators.flatMap((c) => c.genres))], [creators]);

  const filtered = creators.filter((c) => {
    const s = followerScales.find((x) => x.id === scale);
    return (
      (!area || c.areas.includes(area as Creator["areas"][number])) &&
      (!genre || c.genres.includes(genre as Creator["genres"][number])) &&
      (!s || (c.followers >= s.min && c.followers <= s.max))
    );
  });

  const showFilter = creators.length >= FILTER_THRESHOLD;
  const select = "field-input min-h-12! py-2! text-sm";

  return (
    <div>
      {showFilter && (
        <div className="mb-10 grid gap-4 rounded-[24px] bg-mist p-5 sm:grid-cols-3 md:p-6">
          <label className="text-xs font-bold">
            活動エリア
            <select className={cn(select, "mt-2")} value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">すべて</option>
              {areas.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold">
            グルメジャンル
            <select className={cn(select, "mt-2")} value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">すべて</option>
              {genres.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold">
            フォロワー規模
            <select className={cn(select, "mt-2")} value={scale} onChange={(e) => setScale(e.target.value)}>
              <option value="">すべて</option>
              {followerScales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {filtered.length}人の発信者を表示しています
      </p>

      {filtered.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <CreatorCard creator={c} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-mist p-10 text-center text-sm text-muted">
          条件に合う発信者が見つかりませんでした。条件を変更するか、お問い合わせからご相談ください。
        </p>
      )}
    </div>
  );
}
