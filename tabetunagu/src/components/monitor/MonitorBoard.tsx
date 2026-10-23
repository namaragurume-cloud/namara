"use client";

import { Bell, BellOff, CircleCheck, Maximize2, Minimize2, Sun, Wifi, WifiOff, X } from "lucide-react";
import { memo, useEffect, useReducer, useRef, useState } from "react";
import { logMonitorUsageAction } from "@/app/actions/monitor";
import {
  activeNote,
  monitorSections,
  nextPickupStart,
  PICKED_UP_VISIBLE,
  recentPickups,
  startUrgency,
  type MonitorOrder,
  type MonitorSnapshot,
  type PickupPhase,
} from "@/lib/monitor";
import { connectionLabel, initMonitorSync, monitorSyncReducer } from "@/lib/monitor-sync";
import { cn } from "../ui/cn";
import { audioReady, playChime, unlockAudio } from "./chime";
import {
  enterFullscreen,
  leaveFullscreen,
  releaseWakeLock,
  requestWakeLock,
  wakeLockStatus,
  type WakeLockSentinelLike,
  type WakeLockStatus,
} from "./kiosk";

/** 更新間隔。受取完了から店舗モニターへの反映を 1〜3 秒以内にする */
const POLL_MS = 2000;
const MINUTE = 60_000;
/** 全画面の案内を一度表示したか（この端末だけの記録） */
const GUIDE_KEY = "tabetunagu.monitor.guideSeen";

const SECTIONS: { phase: PickupPhase; title: string; empty: string }[] = [
  { phase: "active", title: "今受取できます", empty: "現在、受取時間中の注文はありません。" },
  { phase: "upcoming", title: "これから", empty: "これからの受取予定はありません。" },
  { phase: "picked_up", title: "受取完了", empty: "まだ受取完了はありません。" },
  { phase: "unclaimed", title: "未受取", empty: "未受取の注文はありません。" },
];

const hm = (at: string | number) =>
  new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(at));

/**
 * 店舗モニター（商品を渡すための画面。見るだけ）。受取完了はお客様のスワイプで自動的に反映される。
 * 店舗側の完了・受取・決済・QR などの操作ボタンは置かない（店舗都合のキャンセルは「注文（事前決済）」の画面）。
 * 同期の状態（通知音・受取完了の強調・通信断・最終更新）は lib/monitor-sync の状態遷移で管理する。
 */
export function MonitorBoard({ initial }: { initial: MonitorSnapshot }) {
  const initialAt = Date.parse(initial.generatedAt);
  const [state, dispatch] = useReducer(monitorSyncReducer, initialAt, (at) => initMonitorSync(initial, at));
  // 区分・時計は分単位で十分なので、分が変わったときだけ描き直す（カードの不要な再描画を避ける）
  const [minute, setMinute] = useState(() => Math.floor(initialAt / MINUTE));
  const now = minute * MINUTE;
  const [soundOn, setSoundOn] = useState(false);
  // 全画面モード（店頭タブレット用）: ナビを隠して大きく表示し、可能なら画面スリープを止める
  const [kiosk, setKiosk] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockStatus>("off");
  const [guide, setGuide] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<WakeLockSentinelLike | null>(null);
  const version = useRef(initial.version);
  useEffect(() => {
    version.current = state.snapshot.version;
  }, [state.snapshot.version]);

  // 2秒ごとの軽量ポーリング（画面が隠れている間は取得しない。変化がなければ version だけが返る）。失敗しても表示中の一覧は消さない
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

  // 受取完了の強調の終了（1秒ごと）と時計（分が変わったときだけ）
  useEffect(() => {
    const id = window.setInterval(() => {
      const at = Date.now();
      dispatch({ type: "tick", at });
      setMinute((m) => (Math.floor(at / MINUTE) === m ? m : Math.floor(at / MINUTE)));
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
      sentinel.current = await requestWakeLock(navigator);
      setWakeLock(wakeLockStatus(navigator, sentinel.current, true));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [kiosk]);

  const turnSoundOn = () => {
    if (!unlockAudio()) return false;
    setSoundOn(true);
    void logMonitorUsageAction(initial.storeId, "sound_enabled");
    return true;
  };

  const toggleKiosk = async () => {
    if (kiosk) {
      setKiosk(false);
      setGuide(false);
      await releaseWakeLock(sentinel.current);
      sentinel.current = null;
      setWakeLock("off");
      await leaveFullscreen(document);
      return;
    }
    setKiosk(true);
    void logMonitorUsageAction(initial.storeId, "fullscreen_enabled");
    if (!soundOn) turnSoundOn();
    // 全画面の案内はこの端末で最初の1回だけ
    try {
      if (!window.localStorage.getItem(GUIDE_KEY)) {
        setGuide(true);
        window.localStorage.setItem(GUIDE_KEY, "1");
      }
    } catch {
      // 保存できない環境では毎回出さない
    }
    await enterFullscreen(rootRef.current);
    sentinel.current = await requestWakeLock(navigator);
    setWakeLock(wakeLockStatus(navigator, sentinel.current, true));
  };

  const enableSound = () => {
    if (turnSoundOn()) playChime();
  };

  const sections = monitorSections(state.snapshot.orders, now);
  const pickedUp = recentPickups(sections.picked_up);
  const nextStart = nextPickupStart(sections.upcoming);
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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className={cn("font-bold leading-tight", kiosk ? "text-[30px]" : "text-[24px]")}>本日の受取</h1>
          <p className={cn("font-semibold text-ink-2", kiosk ? "text-[20px]" : "text-[15px]")} data-testid="monitor-store-name">
            {state.snapshot.storeName}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={cn("tnum font-bold", kiosk ? "text-[40px] leading-none" : "text-[20px]")}
            aria-label={`現在時刻 ${hm(now)}`}
            data-testid="monitor-clock"
          >
            {hm(now)}
          </span>
          {soundOn ? (
            <span className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-leaf-soft px-3 text-[13px] font-bold text-forest" data-testid="monitor-sound">
              <Bell className="h-4 w-4" aria-hidden />
              通知音 ON
            </span>
          ) : (
            <button
              type="button"
              onClick={enableSound}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-forest px-4 text-[14px] font-bold text-white"
              data-testid="monitor-sound"
              aria-label="通知音 OFF。押すと通知音をONにします"
            >
              <BellOff className="h-4 w-4" aria-hidden />
              通知音 OFF・通知音をON
            </button>
          )}
          <button
            type="button"
            onClick={toggleKiosk}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-line bg-paper px-4 text-[13px] font-bold"
            data-testid="monitor-kiosk"
          >
            {kiosk ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}
            {kiosk ? "全画面を終了" : "全画面モード"}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p
          className={cn("flex flex-wrap items-center gap-x-2 text-[12.5px]", offline ? "font-bold text-clay" : "text-muted")}
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
        {kiosk && (
          <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-3 py-1 text-[12px] font-semibold text-ink-2" data-testid="wake-lock-status">
            <Sun className="h-4 w-4" aria-hidden />
            画面スリープ防止 {wakeLock === "on" ? "ON" : wakeLock === "off" ? "OFF" : "非対応（端末の自動ロックをOFFにしてください）"}
          </span>
        )}
      </div>

      {guide && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-forest/30 bg-leaf-soft px-4 py-3 text-[15px] text-forest-2" data-testid="monitor-guide">
          <p>
            お客様の受取チケットを確認し、商品をお渡しください。
            <br />
            受取完了はお客様が操作します。
          </p>
          <button type="button" onClick={() => setGuide(false)} aria-label="案内を閉じる" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}

      {sections.unclaimed.length > 0 && (
        <a href="#monitor-unclaimed" className="block rounded-xl bg-clay-soft px-3 py-2 text-[13px] font-semibold text-clay" data-testid="monitor-unclaimed-alert">
          未受取が{sections.unclaimed.length}件あります（下の「未受取」をご確認ください）
        </a>
      )}

      <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {SECTIONS.map((s) => (
          <div
            key={s.phase}
            className={cn(
              "rounded-2xl px-2 py-3",
              s.phase === "active" ? "bg-forest text-white" : s.phase === "unclaimed" && sections.unclaimed.length > 0 ? "bg-clay-soft" : "bg-canvas",
            )}
          >
            <dt className={cn("font-bold", kiosk ? "text-[18px]" : "text-[13px]", s.phase === "active" ? "text-white" : "text-ink-2")}>{s.title}</dt>
            <dd
              className={cn("tnum font-bold leading-tight", kiosk ? (s.phase === "active" ? "text-[64px]" : "text-[44px]") : s.phase === "active" ? "text-[40px]" : "text-[30px]")}
              data-testid={`monitor-count-${s.phase}`}
              aria-label={`${s.title} ${sections[s.phase].length}件`}
            >
              {sections[s.phase].length}
              <span className={cn("ml-0.5 font-semibold", kiosk ? "text-[20px]" : "text-[13px]")}>件</span>
            </dd>
          </div>
        ))}
      </dl>

      {SECTIONS.map((s) => {
        const list = s.phase === "picked_up" ? pickedUp : sections[s.phase];
        const shown = s.phase === "picked_up" ? list.slice(0, PICKED_UP_VISIBLE) : list;
        const folded = s.phase === "picked_up" ? list.slice(PICKED_UP_VISIBLE) : [];
        return (
          <section key={s.phase} id={`monitor-${s.phase.replace("_", "-")}`} aria-labelledby={`monitor-title-${s.phase}`} data-testid={`monitor-section-${s.phase}`}>
            <h2 id={`monitor-title-${s.phase}`} className={cn("mb-2 font-bold", kiosk ? "text-[24px]" : "text-[16px]")}>
              {s.title}
              <span className="tnum ml-1.5 text-muted">{list.length}件</span>
            </h2>
            {list.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-4 text-center text-[14px] text-ink-2" data-testid={`monitor-empty-${s.phase}`}>
                {s.empty}
                {s.phase === "active" && nextStart && <span className="mt-0.5 block font-bold text-ink">次の受取予定は{hm(nextStart)}です。</span>}
              </p>
            ) : (
              <>
                <ul className="space-y-2">
                  {shown.map((o) => (
                    <MonitorCard key={o.id} order={o} phase={s.phase} now={now} highlight={Boolean(state.highlights[o.id])} kiosk={kiosk} />
                  ))}
                </ul>
                {folded.length > 0 && (
                  <details className="mt-2" data-testid="monitor-picked-up-more">
                    <summary className="min-h-[44px] cursor-pointer content-center text-[13px] font-semibold text-ink-2">
                      ほか{folded.length}件の受取完了を表示
                    </summary>
                    <ul className="mt-2 space-y-2">
                      {folded.map((o) => (
                        <MonitorCard key={o.id} order={o} phase={s.phase} now={now} highlight={Boolean(state.highlights[o.id])} kiosk={kiosk} />
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </section>
        );
      })}

      <p className="pt-2 text-center text-[11px] tracking-[0.1em] text-muted">売れたら、渡すだけ。</p>
    </div>
  );
}

/**
 * 注文カード。優先順: 注文番号 → 商品名 → 数量 → 受取時間 → お客様（伏せ字）→ 状態。操作ボタンは置かない。
 * 区分・時刻・強調が変わったときだけ描き直す。
 */
const MonitorCard = memo(function MonitorCard({
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
  const late = phase === "active" ? activeNote(o, now) : null;
  return (
    <li
      data-testid="monitor-card"
      data-order-number={o.orderNumber}
      data-highlight={highlight ? "on" : "off"}
      data-urgency={urgency?.level}
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-l-8 px-4 py-3 transition-colors",
        phase === "active" && "border-forest bg-leaf-soft",
        phase === "upcoming" &&
          (urgency?.level === "imminent" ? "border-forest bg-paper" : urgency?.level === "soon" ? "border-leaf bg-paper" : "border-line bg-paper"),
        phase === "picked_up" && (highlight ? "border-forest bg-leaf-soft ring-4 ring-leaf" : "border-leaf/50 bg-leaf-soft/40 text-ink-2"),
        phase === "unclaimed" && "border-clay/60 bg-clay-soft/60",
      )}
    >
      <div className={cn("shrink-0", kiosk ? "w-[170px]" : "w-[118px]")}>
        <p className={cn("font-en font-bold leading-none tracking-wide text-ink", kiosk ? "text-[32px]" : "text-[21px]")} data-testid="monitor-card-number">
          #{o.orderNumber}
        </p>
        <p className={cn("tnum mt-1.5 font-bold", kiosk ? "text-[22px]" : "text-[14px]")}>
          {hm(o.pickupStartAt)}〜{hm(o.pickupEndAt)}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <ul className={cn("font-bold leading-snug text-ink", kiosk ? "text-[26px]" : "text-[18px]")}>
          {o.items.map((i, n) => (
            <li key={n} className="line-clamp-2">
              {i.name} <span className="tnum whitespace-nowrap">×{i.quantity}</span>
            </li>
          ))}
        </ul>
        <p className={cn("truncate text-ink-2", kiosk ? "text-[16px]" : "text-[13px]")}>
          {o.customerName}
          {late && <span className="ml-2 font-bold text-clay">{late}</span>}
        </p>
      </div>
      <StatusBadge order={o} phase={phase} urgency={urgency} highlight={highlight} kiosk={kiosk} />
    </li>
  );
});

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
  const size = kiosk ? "px-4 py-2 text-[17px]" : "px-3 py-1 text-[13px]";
  const badge = (className: string, text: string, icon?: boolean) => (
    <span className={cn("tnum inline-flex shrink-0 items-center gap-1 rounded-full font-bold", size, className)} data-testid="monitor-card-status">
      {icon && <CircleCheck className="h-4 w-4" aria-hidden />}
      {text}
    </span>
  );
  if (phase === "picked_up") {
    return highlight
      ? badge("bg-forest text-white", "✓ 受取完了")
      : badge("bg-paper text-forest border border-forest/40", `済 受取完了${o.pickedUpAt ? ` ${hm(o.pickedUpAt)}` : ""}`, true);
  }
  if (phase === "unclaimed") return badge("border border-clay/50 bg-paper text-clay", "未受取");
  if (phase === "upcoming") {
    if (urgency?.level === "imminent") return badge("bg-forest text-white", urgency.label ?? "");
    if (urgency?.level === "soon") return badge("border-2 border-forest text-forest", urgency.label ?? "");
    return badge("bg-canvas text-ink-2", urgency && urgency.minutes <= 60 ? `あと${urgency.minutes}分` : `${hm(o.pickupStartAt)}から`);
  }
  return badge("bg-forest text-white", "受取時間中");
}
