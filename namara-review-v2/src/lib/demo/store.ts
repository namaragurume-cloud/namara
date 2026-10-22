"use client";

import { useMemo, useSyncExternalStore } from "react";

import { DEMO_TODAY } from "@/lib/constants";
import { canOnStore } from "@/lib/permissions";
import type { Member, Review } from "@/lib/types";
import { currentMember, currentOrganization, demoReducer, STATE_VERSION, type DemoAction, type DemoState } from "./reducer";
import { createIncomingReview, createSeedData } from "./seed";

/**
 * Phase 1 のデモ用ストア。ブラウザの localStorage に保存するだけで、外部には一切送信しない。
 * Phase 2 で Supabase（サーバー）に置き換える。
 */

const STORAGE_KEY = "namara-review-demo";

function createInitialState(): DemoState {
  return {
    ...structuredClone(createSeedData()),
    version: STATE_VERSION,
    currentUserId: "user_owner",
    selectedStoreId: "all",
    simulateFailure: false,
    syncCount: 0,
  };
}

const serverState = createInitialState();
let state: DemoState = serverState;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as DemoState;
    if (parsed?.version === STATE_VERSION && Array.isArray(parsed.reviews)) {
      // 投稿処理の途中でページを閉じた場合は「失敗」として再試行できるようにする
      parsed.reviews = parsed.reviews.map((r) => (r.status === "publishing" ? { ...r, status: "failed" } : r));
      state = parsed;
    }
  } catch {
    // 保存データが壊れている・ストレージが使えない場合はサンプルデータで起動する
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let flushRegistered = false;

function flush() {
  if (saveTimer === undefined) return;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 保存できなくても画面操作は継続できる
  }
}

function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 300);
  if (!flushRegistered) {
    flushRegistered = true;
    // 保存待ちの間にページを閉じた・再読み込みした場合も変更を失わない
    window.addEventListener("pagehide", flush);
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function dispatch(action: DemoAction) {
  load();
  const next = demoReducer(state, action);
  if (next === state) return false;
  state = next;
  persist();
  emit();
  return true;
}

export function getState() {
  load();
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDemoState<T>(selector: (s: DemoState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(serverState),
  );
}

const sessionStartedAt = Date.now();

/** デモ内の「現在時刻」。DEMO_TODAY を起点に経過時間を足す（イベント処理内でのみ呼ぶ） */
export function demoNow() {
  const date = new Date(new Date(DEMO_TODAY).getTime() + (Date.now() - sessionStartedAt));
  const jst = new Date(date.getTime() + 9 * 3600000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${jst.getUTCFullYear()}-${p(jst.getUTCMonth() + 1)}-${p(jst.getUTCDate())}T${p(jst.getUTCHours())}:${p(jst.getUTCMinutes())}:${p(jst.getUTCSeconds())}+09:00`;
}

export function resetDemo() {
  state = createInitialState();
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
  emit();
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 承認して Google に投稿（モック）。
 * 冪等キー（口コミID:下書きバージョン）で二重投稿を防ぐ。
 */
export async function approveAndPublish(reviewId: string): Promise<{ ok: boolean; message: string }> {
  const before = getState();
  const draft = before.drafts[reviewId];
  if (!draft) return { ok: false, message: "返信案がありません" };
  const idempotencyKey = `${reviewId}:${draft.version}`;
  const started = dispatch({ type: "publishStarted", reviewId, idempotencyKey, at: demoNow() });
  if (!started) return { ok: false, message: "この返信は投稿できない状態です（権限がない、または投稿中・投稿済みです）" };

  await wait(1200);

  const review = getState().reviews.find((r) => r.id === reviewId);
  const store = getState().stores.find((s) => s.id === review?.storeId);
  let error: string | null = null;
  if (getState().simulateFailure) {
    error = "Google Business Profile API がエラーを返しました（デモ：失敗シミュレーション中）";
  } else if (store?.googleStatus !== "connected") {
    error = "Googleの認証の有効期限が切れています（デモ）。店舗設定からGoogle連携を再接続してください。";
  }
  dispatch({ type: "publishFinished", reviewId, idempotencyKey, ok: error === null, error, at: demoNow() });
  return error ? { ok: false, message: error } : { ok: true, message: "Googleに返信を投稿しました（デモ）" };
}

/** 「Googleから同期」（モック）。接続済み店舗に新着口コミを追加する */
export async function syncReviews() {
  await wait(900);
  const current = getState();
  const at = demoNow();
  const connected = current.stores.filter((s) => s.googleStatus === "connected");
  const incoming: Review[] = connected
    .slice(0, 2)
    .map((store, i) => createIncomingReview(store, current.syncCount * 10 + i, at));
  dispatch({ type: "reviewsSynced", reviews: incoming, at });
  return incoming.length;
}

export function useCurrentMember(): Member {
  return useDemoState(currentMember);
}

/** ログイン中のユーザーが所属する法人 */
export function useCurrentOrganization() {
  return useDemoState(currentOrganization);
}

/** 現在のユーザーが見られる店舗 */
export function useAccessibleStores() {
  const stores = useDemoState((s) => s.stores);
  const me = useCurrentMember();
  return useMemo(() => stores.filter((store) => canOnStore(me, "reply.edit", store)), [stores, me]);
}

/** 店舗切替の選択を反映した口コミ（担当外の店舗は常に除外） */
export function useScopedReviews() {
  const reviews = useDemoState((s) => s.reviews);
  const selected = useDemoState((s) => s.selectedStoreId);
  const stores = useAccessibleStores();
  return useMemo(() => {
    const allowed = new Set(stores.map((s) => s.id));
    return reviews.filter((r) => allowed.has(r.storeId) && (selected === "all" || r.storeId === selected));
  }, [reviews, selected, stores]);
}
