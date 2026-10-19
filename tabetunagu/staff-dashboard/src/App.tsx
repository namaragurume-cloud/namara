import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmModal } from "./components/ConfirmModal";
import { DemoPanel } from "./components/DemoPanel";
import { RevenuePanel } from "./components/RevenuePanel";
import { SummaryHeader } from "./components/SummaryHeader";
import { Timeline } from "./components/Timeline";
import { createSource } from "./data/source";
import type { Pickup, Snapshot } from "./data/types";
import { audioReady, playChime, unlockAudio } from "./lib/chime";
import { hm, useNow, useWakeLock } from "./lib/useNow";

type Announcement = { id: number; title: string; body: string; tone: "done" | "new" | "info" };

export function App() {
  const [{ source, demo }] = useState(createSource);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [bumpKey, setBumpKey] = useState(0);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [confirming, setConfirming] = useState<Pickup | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const prev = useRef<Map<string, Pickup> | null>(null);
  const now = useNow();
  useWakeLock();

  const announce = useCallback((a: Omit<Announcement, "id">) => {
    const id = Date.now();
    setAnnouncement({ ...a, id });
    window.setTimeout(() => setAnnouncement((cur) => (cur?.id === id ? null : cur)), 3800);
  }, []);

  // データ更新の差分から「受取完了になった」「新しい予約が入った」を検出し、音・アニメーションを出す
  useEffect(
    () =>
      source.subscribe((next) => {
        setSnapshot(next);
        const before = prev.current;
        prev.current = new Map(next.pickups.map((p) => [p.id, p]));
        if (!before) return;
        const completed = next.pickups.filter((p) => p.status === "completed" && before.get(p.id)?.status === "waiting");
        const added = next.pickups.filter((p) => !before.has(p.id));
        if (completed.length) {
          playChime();
          setFlashIds(new Set(completed.map((p) => p.id)));
          setBumpKey((k) => k + 1);
          window.setTimeout(() => setFlashIds(new Set()), 2200);
          const p = completed[0];
          announce({
            tone: "done",
            title: `${p.customerName}が受け取りました`,
            body: `${p.items.map((i) => `${i.name}×${i.qty}`).join("・")}${p.completedVia === "manual" ? "（手動完了）" : ""}`,
          });
        } else if (added.length) {
          setBumpKey((k) => k + 1);
          const p = added[0];
          announce({ tone: "new", title: `新しい予約：${p.customerName}`, body: `${hm(p.start)}〜${hm(p.end)}・${p.items.map((i) => `${i.name}×${i.qty}`).join("・")}` });
        }
      }),
    [source, announce],
  );

  const enableSound = () => {
    if (unlockAudio()) window.setTimeout(() => setSoundOn(audioReady()), 50);
  };

  const confirmManual = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      await source.completeManually(confirming.id);
      setConfirming(null);
    } catch {
      announce({ tone: "info", title: "記録できませんでした", body: "通信を確認して、もう一度お試しください。" });
    } finally {
      setBusy(false);
    }
  };

  if (!snapshot) {
    return <div className="flex h-full items-center justify-center text-xl font-bold text-stone-500">読み込み中…</div>;
  }

  const listed = snapshot.listings.reduce((s, l) => s + l.quantity, 0);
  const sold = snapshot.pickups.reduce((s, p) => s + p.items.reduce((t, i) => t + i.qty, 0), 0);
  const waitingCount = snapshot.pickups.filter((p) => p.status === "waiting").length;
  const todayGmv = snapshot.pickups.filter((p) => p.status === "completed").reduce((s, p) => s + p.total, 0);

  return (
    <div className="mx-auto flex h-full max-w-[920px] flex-col pb-[env(safe-area-inset-bottom)]" onPointerDown={!soundOn ? enableSound : undefined}>
      <header className="relative flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(10px+env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2.5">
          <img src="./mark.png" alt="" className="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-lg font-black leading-tight sm:text-xl">{snapshot.storeName}</p>
            <p className="truncate text-xs font-bold text-stone-500">
              本日の状況・{hm(snapshot.updatedAt)} 更新・{source.label}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <p className="num text-[28px] font-extrabold sm:text-[34px]">{hm(now)}</p>
          {demo && (
            <button
              type="button"
              aria-expanded={demoOpen}
              onClick={() => {
                enableSound();
                setDemoOpen((v) => !v);
              }}
              className="rounded-full border-2 border-stone-900 px-3 py-1.5 text-sm font-black"
            >
              テスト
            </button>
          )}
        </div>
        {demo && demoOpen && (
          <DemoPanel
            demo={demo}
            onClose={() => setDemoOpen(false)}
            onAction={(msg) => {
              enableSound();
              if (msg) announce({ tone: "info", title: msg, body: "" });
            }}
          />
        )}
      </header>

      {!soundOn && (
        <button type="button" onClick={enableSound} className="mx-3 mb-2 rounded-2xl bg-stone-900 px-4 py-2.5 text-base font-black text-white sm:mx-4">
          🔔 ここをタップすると、受け取り時に音が鳴ります
        </button>
      )}

      <main className="flex min-h-0 flex-1 flex-col gap-3 px-3 sm:gap-4 sm:px-4">
        <SummaryHeader listed={listed} sold={sold} remaining={Math.max(0, listed - sold)} waitingCount={waitingCount} bumpKey={bumpKey} />
        <Timeline pickups={snapshot.pickups} now={now} flashIds={flashIds} onRequestManualComplete={setConfirming} />
        <RevenuePanel plan={snapshot.plan} gmv={snapshot.monthGmvBeforeToday + todayGmv} />
      </main>

      {announcement && (
        <div
          key={announcement.id}
          role="status"
          className={`animate-drop fixed left-1/2 top-[calc(12px+env(safe-area-inset-top))] z-40 w-[min(94vw,620px)] rounded-3xl px-5 py-4 shadow-2xl ${
            announcement.tone === "done" ? "bg-leaf text-white" : announcement.tone === "new" ? "bg-wait text-stone-950" : "bg-stone-900 text-white"
          }`}
        >
          <p className="text-[24px] font-black leading-tight sm:text-[28px]">{announcement.title}</p>
          {announcement.body && <p className="mt-0.5 text-lg font-bold opacity-90">{announcement.body}</p>}
        </div>
      )}

      {confirming && <ConfirmModal pickup={confirming} busy={busy} onConfirm={confirmManual} onCancel={() => setConfirming(null)} />}
    </div>
  );
}
