"use client";

import { Bell, BellOff, Maximize2, Minimize2, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { detectNewPickups, pickupPhase, type MonitorOrder, type MonitorSnapshot, type PickupPhase } from "@/lib/monitor";
import { cn } from "../ui/cn";
import { audioReady, playChime, unlockAudio } from "./chime";
import { enterFullscreen, leaveFullscreen, releaseWakeLock, requestWakeLock, type WakeLockSentinelLike } from "./kiosk";

/** 更新間隔。受取完了から店舗モニターへの反映を 1〜3 秒以内にする */
const POLL_MS = 2000;

const SECTIONS: { phase: PickupPhase; title: string; empty: string }[] = [
  { phase: "active", title: "受取時間中", empty: "いま受取時間中の注文はありません" },
  { phase: "upcoming", title: "これから", empty: "これからの注文はありません" },
  { phase: "picked_up", title: "受取完了", empty: "まだ受取完了はありません" },
  { phase: "unclaimed", title: "未受取", empty: "未受取の注文はありません" },
];

const hm = (iso: string) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

/**
 * 店舗モニター（見るだけ）。受取完了はお客様のスワイプで自動的に反映される。
 * 店舗側の完了・受取・決済などの操作ボタンは置かない。
 */
export function MonitorBoard({ initial }: { initial: MonitorSnapshot }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [now, setNow] = useState(() => Date.parse(initial.generatedAt));
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [soundOn, setSoundOn] = useState(false);
  const [offline, setOffline] = useState(false);
  // 全画面モード（店頭タブレット用）: ナビを隠して大きく表示し、可能なら画面スリープを止める
  const [kiosk, setKiosk] = useState(false);
  const [wakeLockOn, setWakeLockOn] = useState<boolean | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);
  // 初回表示の受取完了は「既知」として記録するだけ（過去分では鳴らさない）
  const known = useRef<ReadonlySet<string>>(detectNewPickups(null, initial.orders).known);
  const version = useRef(initial.version);

  const apply = useCallback((next: MonitorSnapshot) => {
    const { fresh, known: k } = detectNewPickups(known.current, next.orders);
    known.current = k;
    version.current = next.version;
    setSnapshot(next);
    if (fresh.length > 0) {
      if (audioReady()) playChime();
      setFlash(new Set(fresh));
      window.setTimeout(() => setFlash(new Set()), 4000);
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/store/monitor?store=${encodeURIComponent(initial.storeId)}&v=${encodeURIComponent(version.current)}`, {
            cache: "no-store",
          });
          const body = (await res.json()) as { ok: boolean; unchanged?: boolean; snapshot?: MonitorSnapshot };
          setOffline(!res.ok);
          if (body.ok && body.snapshot) apply(body.snapshot);
        } catch {
          setOffline(true);
        }
        setNow(Date.now());
      }
      timer = window.setTimeout(tick, POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [initial.storeId, apply]);

  // 画面が隠れると Wake Lock は自動で解除されるため、全画面モード中に表示が戻ったら取り直す
  useEffect(() => {
    if (!kiosk) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      wakeLock.current = await requestWakeLock(navigator);
      setWakeLockOn(Boolean(wakeLock.current));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [kiosk]);

  const toggleKiosk = async () => {
    if (kiosk) {
      setKiosk(false);
      await releaseWakeLock(wakeLock.current);
      wakeLock.current = null;
      setWakeLockOn(null);
      await leaveFullscreen(document);
      return;
    }
    setKiosk(true);
    if (!soundOn && unlockAudio()) setSoundOn(true);
    await enterFullscreen(rootRef.current);
    wakeLock.current = await requestWakeLock(navigator);
    setWakeLockOn(Boolean(wakeLock.current));
  };

  const enableSound = () => {
    if (unlockAudio()) {
      setSoundOn(true);
      playChime();
    }
  };

  const byPhase = (phase: PickupPhase) => snapshot.orders.filter((o) => pickupPhase(o, now) === phase);

  return (
    <div
      ref={rootRef}
      className={cn("space-y-4", kiosk && "fixed inset-0 z-[60] overflow-y-auto bg-paper p-5 text-[1.15em] sm:p-8")}
      data-testid="store-monitor"
      data-kiosk={kiosk ? "on" : "off"}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {kiosk && <p className="text-[18px] font-bold">{snapshot.storeName}・本日の受取</p>}
          <p className="text-[13px] text-muted" aria-live="polite">
            {offline ? "接続を確認しています…" : `最終更新 ${hm(new Date(now).toISOString())}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {kiosk && (
            <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-3 py-2 text-[12px] font-semibold text-ink-2" data-testid="wake-lock-status">
              <Sun className="h-4 w-4" aria-hidden />
              {wakeLockOn ? "画面スリープ防止 ON" : "画面スリープ防止 非対応（端末の設定で自動ロックをオフに）"}
            </span>
          )}
          <button
            type="button"
            onClick={toggleKiosk}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-4 py-2 text-[13px] font-bold"
            data-testid="monitor-kiosk"
          >
            {kiosk ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
            {kiosk ? "全画面を終了" : "全画面モード"}
          </button>
        <button
          type="button"
          onClick={enableSound}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold",
            soundOn ? "bg-leaf-soft text-forest" : "bg-forest text-white",
          )}
          data-testid="monitor-sound"
        >
          {soundOn ? <Bell className="h-4 w-4" aria-hidden /> : <BellOff className="h-4 w-4" aria-hidden />}
          {soundOn ? "受取通知音 ON" : "受取通知音をON"}
        </button>
        </div>
      </div>

      <dl className="grid grid-cols-4 gap-2 text-center">
        {SECTIONS.map((s) => (
          <div key={s.phase} className="rounded-2xl bg-canvas px-2 py-3">
            <dt className="text-[12px] font-semibold text-muted">{s.title}</dt>
            <dd className="tnum text-[28px] font-bold leading-tight" data-testid={`monitor-count-${s.phase}`}>
              {byPhase(s.phase).length}
            </dd>
          </div>
        ))}
      </dl>

      {SECTIONS.map((s) => {
        const list = byPhase(s.phase);
        return (
          <section key={s.phase} aria-label={s.title} data-testid={`monitor-section-${s.phase}`}>
            <h2 className="mb-2 text-[15px] font-bold">{s.title}</h2>
            {list.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-4 text-center text-[13px] text-muted">{s.empty}</p>
            ) : (
              <ul className="space-y-2">
                {list.map((o) => (
                  <MonitorCard key={o.id} order={o} phase={s.phase} flash={flash.has(o.id)} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

const STATUS_LABEL: Record<PickupPhase, string> = {
  upcoming: "支払い済み",
  active: "支払い済み・受取待ち",
  picked_up: "受取完了",
  unclaimed: "未受取",
};

function MonitorCard({ order: o, phase, flash }: { order: MonitorOrder; phase: PickupPhase; flash: boolean }) {
  const items = o.items.map((i) => `${i.name}×${i.quantity}`).join("・");
  return (
    <li
      data-testid="monitor-card"
      data-order-number={o.orderNumber}
      className={cn(
        "flex items-center gap-3 rounded-2xl border-l-8 px-4 py-3 transition-colors",
        phase === "active" && "border-forest bg-leaf-soft",
        phase === "upcoming" && "border-line bg-paper",
        phase === "picked_up" && "border-line bg-canvas text-ink-2",
        phase === "unclaimed" && "border-clay bg-clay-soft",
        flash && "ring-4 ring-leaf",
      )}
    >
      <div className="w-[92px] shrink-0">
        <p className="tnum text-[22px] font-bold leading-none">{hm(o.pickupStartAt)}</p>
        <p className="tnum mt-1 text-[13px] font-semibold opacity-70">〜{hm(o.pickupEndAt)}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-bold leading-snug">{items}</p>
        <p className="truncate text-[13px] text-ink-2">
          {o.customerName}・<span className="font-en">#{o.orderNumber}</span>
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-3 py-1 text-[12.5px] font-bold",
          phase === "picked_up" ? "bg-ink text-white" : phase === "unclaimed" ? "bg-clay text-white" : "bg-forest text-white",
        )}
      >
        {phase === "picked_up" && o.pickedUpAt ? `${STATUS_LABEL[phase]} ${hm(o.pickedUpAt)}` : STATUS_LABEL[phase]}
      </span>
    </li>
  );
}
