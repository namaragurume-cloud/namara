"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send } from "lucide-react";
import type { PublicSearchOutcome } from "@/lib/shared/public";
import { describeConditions } from "./conditions";
import { OrganicStoreCard, SponsoredStoreCard } from "./StoreCard";

type Message = { id: string; role: "user"; text: string } | { id: string; role: "bot"; outcome: PublicSearchOutcome } | { id: string; role: "error"; text: string };

const EXAMPLES = ["すすきの 焼肉 予算8000円", "札幌駅でランチ 1500円以内", "大通でデート向けのイタリアン、個室あり", "子連れで行ける海鮮のお店", "札幌 イタリアン"];

function BotAnswer({ outcome }: { outcome: PublicSearchOutcome }) {
  const conditions = describeConditions(outcome.parse.conditions);
  return (
    <div className="space-y-3">
      {conditions.length > 0 && (
        <div className="rounded-xl bg-surface px-3 py-2 text-xs">
          <span className="font-bold text-navy">読み取った条件：</span>
          {conditions.map((c) => (
            <span key={c.label} className="mr-2 inline-block">
              {c.label} <strong className="text-ink">{c.value}</strong>
            </span>
          ))}
        </div>
      )}
      <p className="text-sm text-ink">
        {outcome.results.length > 0
          ? `条件に合うお店を${outcome.results.length}件見つけました。${outcome.totalCandidates > outcome.results.length ? `（候補${outcome.totalCandidates}件から上位を表示）` : ""}`
          : "条件に合うお店が見つかりませんでした。"}
      </p>
      {outcome.parse.notes.map((n) => (
        <p key={n} className="text-xs text-muted">
          {n}
        </p>
      ))}
      <div className="space-y-3">
        {outcome.results.map((r) => (
          <OrganicStoreCard key={r.store.id} item={r} searchId={outcome.searchId} />
        ))}
      </div>
      {outcome.sponsored && <SponsoredStoreCard item={outcome.sponsored} />}
      {outcome.suggestions.length > 0 && (
        <div className="rounded-lg border border-line px-3 py-2 text-xs text-muted">
          <p className="font-bold text-ink">条件を変えると見つかるかもしれません</p>
          <ul className="mt-1 list-disc pl-4">
            {outcome.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ChatDemo() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const lastSearchId = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(value: string) {
    const query = value.trim();
    if (!query || loading) return;
    setText("");
    setLoading(true);
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", text: query }]);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: query, refinedFrom: lastSearchId.current }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error ?? "検索に失敗しました。時間をおいてお試しください。");
      const outcome = data as PublicSearchOutcome;
      lastSearchId.current = outcome.searchId;
      setMessages((m) => [...m, { id: outcome.searchId, role: "bot", outcome }]);
    } catch (error) {
      setMessages((m) => [...m, { id: crypto.randomUUID(), role: "error", text: error instanceof Error ? error.message : "検索に失敗しました。" }]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(text);
  }

  return (
    <div className="flex min-h-[70dvh] flex-col">
      <div className="flex-1 space-y-4 pb-4">
        <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-blue-soft px-4 py-3 text-sm text-ink">
          なまらAIです🍜 エリア・食べたいもの・予算などを、話すように送ってください。
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => void send(ex)} className="rounded-full border border-blue/30 bg-paper px-2.5 py-1 text-xs text-navy hover:border-blue">
                {ex}
              </button>
            ))}
          </div>
        </div>

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm bg-navy px-4 py-2 text-sm text-white">
              {m.text}
            </div>
          ) : m.role === "error" ? (
            <div key={m.id} role="alert" className="max-w-[90%] rounded-2xl rounded-tl-sm border border-red-200 bg-red-50 px-4 py-2 text-sm text-bad">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="max-w-full">
              <BotAnswer outcome={m.outcome} />
            </div>
          ),
        )}
        {loading && <p className="text-sm text-muted" aria-live="polite">お店を探しています…</p>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="sticky bottom-0 border-t border-line bg-paper/95 pt-3 pb-4 backdrop-blur">
        <div className="flex gap-2">
          <label htmlFor="q" className="sr-only">検索したい内容</label>
          <input
            id="q"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            placeholder="例：すすきの 焼肉 予算8000円"
            className="min-w-0 flex-1 rounded-full border border-line px-4 py-2.5 text-base focus:border-blue focus:outline-none"
          />
          <button type="submit" disabled={loading || !text.trim()} className="inline-flex items-center gap-1 rounded-full bg-navy px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            <Send className="size-4" aria-hidden />
            送信
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          検索内容はサービス改善と、個人を特定できない形での飲食店向け統計に利用します。詳しくは<a href="/privacy" className="underline">プライバシーポリシー（草案）</a>をご覧ください。
        </p>
      </form>
    </div>
  );
}
