/**
 * 店頭タブレット用の全画面表示・画面スリープ防止。
 * どちらもブラウザによっては使えない（iOS の一部・LINE 内ブラウザなど）。使えない・失敗したときは何もせず false / null を返し、
 * 通常の表示のまま動かす（例外を外に出さない）。どちらもユーザーの操作（ボタンを押す）から呼ぶこと。
 */
export type FullscreenTarget = { requestFullscreen?: () => Promise<void> } | null | undefined;
export type FullscreenDocument = { fullscreenElement?: unknown; exitFullscreen?: () => Promise<void> } | null | undefined;

export async function enterFullscreen(el: FullscreenTarget): Promise<boolean> {
  try {
    if (!el?.requestFullscreen) return false;
    await el.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export async function leaveFullscreen(doc: FullscreenDocument): Promise<void> {
  try {
    if (doc?.fullscreenElement && doc.exitFullscreen) await doc.exitFullscreen();
  } catch {
    // 何もしない
  }
}

export type WakeLockSentinelLike = { release: () => Promise<void>; released?: boolean };
export type WakeLockNavigator = { wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> } } | null | undefined;

/** 画面スリープを止める（Screen Wake Lock API）。非対応・拒否のときは null */
export async function requestWakeLock(nav: WakeLockNavigator): Promise<WakeLockSentinelLike | null> {
  try {
    if (!nav?.wakeLock?.request) return null;
    return await nav.wakeLock.request("screen");
  } catch {
    return null;
  }
}

export async function releaseWakeLock(sentinel: WakeLockSentinelLike | null | undefined): Promise<void> {
  try {
    if (sentinel && !sentinel.released) await sentinel.release();
  } catch {
    // 何もしない
  }
}
