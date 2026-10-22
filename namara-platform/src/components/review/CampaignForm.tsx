"use client";

import { useActionState } from "react";
import { createCampaignAction, type CampaignFormState } from "@/app/actions/ads";
import { AREAS, GENRES } from "@/lib/shared/dictionaries";
import type { Store } from "@/lib/shared/types";

const initial: CampaignFormState = { ok: false, message: "", errors: {} };

export function CampaignForm({ store, today, defaultEnd }: { store: Store; today: string; defaultEnd: string }) {
  const [state, action, pending] = useActionState(createCampaignAction, initial);
  const err = (k: string) => state.errors[k] && <p className="mt-1 text-xs text-bad">{state.errors[k]}</p>;

  return (
    <form action={action} className="space-y-4 text-sm">
      <input type="hidden" name="storeId" value={store.id} />
      <div>
        <label htmlFor="name" className="font-medium">キャンペーン名</label>
        <input id="name" name="name" maxLength={60} required className="mt-1 w-full rounded-lg border border-line px-3 py-2" placeholder="例：忘年会シーズンの個室プラン" />
        {err("name")}
      </div>
      <fieldset>
        <legend className="font-medium">対象エリア（検索条件に含まれるときだけ表示）</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {AREAS.map((a) => (
            <label key={a.id} className="inline-flex items-center gap-1 rounded border border-line px-2 py-1">
              <input type="checkbox" name="areaIds" value={a.id} defaultChecked={a.id === store.areaId} disabled={a.id !== store.areaId} />
              {a.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">店舗の所在エリア以外の検索には表示されないため、選択できるのは所在エリアのみです。</p>
        {err("areaIds")}
      </fieldset>
      <fieldset>
        <legend className="font-medium">対象ジャンル</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {GENRES.filter((g) => store.genreIds.includes(g.id)).map((g) => (
            <label key={g.id} className="inline-flex items-center gap-1 rounded border border-line px-2 py-1">
              <input type="checkbox" name="genreIds" value={g.id} defaultChecked />
              {g.label}
            </label>
          ))}
        </div>
        {err("genreIds")}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="startDate" className="font-medium">開始日</label>
          <input id="startDate" type="date" name="startDate" defaultValue={today} required className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
          {err("startDate")}
        </div>
        <div>
          <label htmlFor="endDate" className="font-medium">終了日</label>
          <input id="endDate" type="date" name="endDate" defaultValue={defaultEnd} required className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
          {err("endDate")}
        </div>
        <div>
          <label htmlFor="budgetYen" className="font-medium">予算（円）</label>
          <input id="budgetYen" type="number" name="budgetYen" min={9800} step={100} defaultValue={9800} required className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
          {err("budgetYen")}
        </div>
      </div>
      <p className="text-xs text-muted">クリック課金（仮：1クリック40円）で予算に達すると自動停止します。現在はモックのため実際の請求・決済は発生しません。</p>
      <button type="submit" disabled={pending} className="rounded-lg bg-navy px-4 py-2 font-bold text-white disabled:opacity-50">
        {pending ? "送信中…" : "審査を申請する"}
      </button>
      {state.message && (
        <p role="status" className={`text-sm ${state.ok ? "text-good" : "text-bad"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
