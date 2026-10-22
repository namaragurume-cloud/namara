"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** ブラウザで描画されたあとに true。保存データの読み込み前に誤った画面を一瞬出さないために使う */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
