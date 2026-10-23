"use client";

import { Bell, BellOff, Maximize2, Minimize2, Sun, Wifi, WifiOff } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";
import { monitorSections, startUrgency, type MonitorOrder, type MonitorSnapshot, type PickupPhase } from "@/lib/monitor";
import { connectionLabel, initMonitorSync, monitorSyncReducer } from "@/lib/monitor-sync";
import { cn } from "../ui/cn";
import { audioReady, playChime, unlockAudio } from "./chime";
import { enterFullscreen, leaveFullscreen, releaseWakeLock, requestWakeLock, type WakeLockSentinelLike } from "./kiosk";

/** 更新間隔。受取完了から店舗モニターへの反映を 1〜3 秒以内にする */
const POLL_MS = 2000;

const SECTIONS: { phase: PickupPhase; title: string; empty: string }[] = [
  { phase: "active", title: "今受取できます", empty: "いま受取時間中の注文はありません" },
  { phase: "upcoming", title: "これから", empty: "これからの注文はありません" },
  { phase: "picked_up", title: "受取完了", empty: "まだ受取完了はありません" },
  { phase: "unclaimed", title: "未受取", empty: "未受取の注文はありません" },
];

const hm = (at: string | number) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(at));

/**
 * 店舗モニター（見るだけ）。受取完了はお客様のスワイプで自動的に反映される。
 * 店舗側の完了・受取・決済などの操作ボタンは置かない。
 * 同期の状態（通知音・受取完了の強調・通信断・最終更新）は lib/monitor-sync の状態遷移で管理する。
 */
export function MonitorBoard({ initial }: { initial: MonitorSnapshot }) {
  const initialAt = Date.parse(initial.generatedAt);
  const [state, dispatch] = useReducer(monitorSyncReducer, initialAt, (at) => initMonitorSync(initial, at));
  const [now, setNow] = useState(initialAt);
  const [soundOn, setSoundOn] = useState(false);
  // 全画面モード（店頭タブレット用）: ナビを隠して大きく表示し、可能なら画面スリープを止める
  const [kiosk, setKiosk] = useState(false);
  const [wakeLockOn, setWakeLockOn] = useState<boolean | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);
  const version = useRef(initial.version);
  useEffect(() => {
    version.current = state.snapshot.version;
  }, [state.snapshot.version]);

  // 2秒ごとの軽量ポーリング（画面が隠れている間は取得しない）。失敗しても表示中の一覧は消さない
  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === "visible") {
        dispatch({ type: "request", at: Date.now() });
        try {
          const res = await fetch(`/api/store/monitor?store=${encodeURIComponent(initial.storeId)}&v=${encodeURIComponent(version.current)}`, {
            cache: "no-store",
          });
          const body = res.ok ? ((await res.json()) as { ok: boolean; unchanged?: boolean; snapshot?: MonitorSnapshot }) : null;
          if (!stopped) {
            if (body?.ok) dispatch({ type: "success", at: Date.now(), snapshot: body.snapshot });
            else dispatch({ type: "failure", at: Date.now() });
          }
        } catch {
          if (!stopped) dispatch({ type: "failure", at: Date.now() });
        }
      }
      timer = window.setTimeout(tick, POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [initial.storeId]);

  // 時計・区分・強調の終了は1秒ごとに進める（通信がなくても時間で区分は変わる）
  useEffect(() => {
    const id = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      dispatch({ type: "tick", at });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // 新しい受取完了を検知したら1回だけ鳴らす
  const chimed = useRef(state.chimes);
  useEffect(() => {
    if (state.chimes > chimed.current) {
      chimed.current = state.chimes;
      if (audioReady()) playChime();
    }
  }, [state.chimes]);

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

  const sections = monitorSections(state.snapshot.orders, now);
  const offline = state.connection !== "ok";

  return (
    <div
      ref={rootRef}
      className={cn("space-y-4", kiosk && "fixed inset-0 z-[60] overflow-y-auto bg-paper p-5 sm:p-8")}
      data-testid="store-monitor"
      data-kiosk={kiosk ? "on" : "off"}
      data-connection={state.connection}
      data-chimes={state.chimes}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {kiosk && (
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-[24px] font-bold">{state.snapshot.storeName}</span>
              <span className="tnum text-[28px] font-bold" data-testid="monitor-clock">
                {hm(now)}
              </span>
            </p>
          )}
          <p
            className={cn("flex flex-wrap items-center gap-x-2 text-[13px]", offline ? "font-bold text-clay" : "text-muted")}
            role="status"
            aria-live="polite"
            data-testid="monitor-connection"
          >
            {offline ? <WifiOff className="h-4 w-4" aria-hidden /> : <Wifi className="h-3.5 w-3.5" aria-hidden />}
            <span>{connectionLabel(state.connection)}</span>
            <span className="tnum" data-testid="monitor-last-synced">
              最終更新 {hm(state.lastSyncedAt)}
            </span>
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
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-line bg-paper px-4 py-2 text-[13px] font-bold"
            data-testid="monitor-kiosk"
          >
            {kiosk ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
            {kiosk ? "全画面を終了" : "全画面モード"}
          </button>
          <button
            type="button"
            onClick={enableSound}
            className={cn(
              "inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold",
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
          <div key={s.phase} className={cn("rounded-2xl px-2 py-3", s.phase === "active" ? "bg-leaf-soft" : "bg-canvas")}>
            <dt className={cn("font-semibold text-ink-2", kiosk ? "text-[16px]" : "text-[12px]")}>{s.title}</dt>
            <dd
              className={cn("tnum font-bold leading-tight", kiosk ? (s.phase === "active" ? "text-[56px]" : "text-[40px]") : "text-[28px]")}
              data-testid={`monitor-count-${s.phase}`}
            >
              {sections[s.phase].length}
            </dd>
          </div>
        ))}
      </dl>

      {SECTIONS.map((s) => {
        const list = sections[s.phase];
        return (
          <section key={s.phase} aria-label={s.title} data-testid={`monitor-section-${s.phase}`}>
            <h2 className={cn("mb-2 font-bold", kiosk ? "text-[22px]" : "text-[15px]")}>{s.title}</h2>
            {list.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-4 text-center text-[13px] text-muted">{s.empty}</p>
            ) : (
              <ul className="space-y-2">
                {list.map((o) => (
                  <MonitorCard key={o.id} order={o} phase={s.phase} now={now} highlight={Boolean(state.highlights[o.id])} kiosk={kiosk} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * 注文カード。優先順: 注文番号 → 商品名 → 数量 → 受取時間 → お客様（伏せ字）→ 状態
 */
function MonitorCard({
  order: o,
  phase,
  now,
  highlight,
  kiosk,
}: {
  order: MonitorOrder;
  phase: PickupPhase;
  now: number;
  highlight: boolean;
  kiosk: boolean;
}) {
  const urgency = phase === "upcoming" ? startUrgency(o.pickupStartAt, now) : null;
  return (
    <li
      data-testid="monitor-card"
      data-order-number={o.orderNumber}
      data-highlight={highlight ? "on" : "off"}
      data-urgency={urgency?.level}
      className={cn(
        "flex items-center gap-3 rounded-2xl border-l-8 px-4 py-3 transition-colors",
        phase === "active" && "border-forest bg-leaf-soft",
        phase === "upcoming" && (urgency?.level === "imminent" ? "border-forest bg-leaf-soft/60" : urgency?.level === "soon" ? "border-leaf bg-paper" : "border-line bg-paper"),
        phase === "picked_up" && (highlight ? "border-forest bg-leaf-soft ring-4 ring-leaf" : "border-line bg-canvas text-ink-2"),
        phase === "unclaimed" && "border-clay bg-clay-soft",
      )}
    >
      <div className={cn("shrink-0", kiosk ? "w-[150px]" : "w-[104px]")}>
        <p className={cn("font-en font-bold leading-none tracking-wide", kiosk ? "text-[30px]" : "text-[19px]")}>#{o.orderNumber}</p>
        <p className={cn("tnum mt-1.5 font-bold", kiosk ? "text-[22px]" : "text-[14px]")}>
          {hm(o.pickupStartAt)}〜{hm(o.pickupEndAt)}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <ul className={cn("font-bold leading-snug", kiosk ? "text-[24px]" : "text-[17px]")}>
          {o.items.map((i, n) => (
            <li key={n} className="line-clamp-2">
              {i.name} <span className="tnum whitespace-nowrap">×{i.quantity}</span>
            </li>
          ))}
        </ul>
        <p className={cn("truncate text-ink-2", kiosk ? "text-[15px]" : "text-[12.5px]")}>{o.customerName}</p>
      </div>
      <StatusBadge order={o} phase={phase} urgency={urgency} highlight={highlight} kiosk={kiosk} />
    </li>
  );
}

function StatusBadge({
  order: o,
  phase,
  urgency,
  highlight,
  kiosk,
}: {
  order: MonitorOrder;
  phase: PickupPhase;
  urgency: ReturnType<typeof startUrgency> | null;
  highlight: boolean;
  kiosk: boolean;
}) {
  const size = kiosk ? "px-4 py-2 text-[16px]" : "px-3 py-1 text-[12.5px]";
  if (phase === "picked_up") {
    return (
      <span className={cn("shrink-0 rounded-full font-bold text-white", size, highlight ? "bg-forest" : "bg-ink")} data-testid="monitor-card-status">
        {highlight ? "✓ 受取完了" : `受取完了${o.pickedUpAt ? ` ${hm(o.pickedUpAt)}` : ""}`}
      </span>
    );
  }
  if (phase === "unclaimed") return <span className={cn("shrink-0 rounded-full bg-clay font-bold text-white", size)}>未受取</span>;
  if (phase === "upcoming") {
    if (urgency?.level === "imminent")
      return <span className={cn("tnum shrink-0 rounded-full bg-forest font-bold text-white", size)}>{urgency.label}</span>;
    if (urgency?.level === "soon")
      return <span className={cn("tnum shrink-0 rounded-full border-2 border-forest font-bold text-forest", size)}>{urgency.label}</span>;
    return <span className={cn("shrink-0 rounded-full bg-canvas font-bold text-ink-2", size)}>支払い済み</span>;
  }
  return <span className={cn("shrink-0 rounded-full bg-forest font-bold text-white", size)}>支払い済み・受取待ち</span>;
}
