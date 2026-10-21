"use client";

import { useState } from "react";

import { useAccessibleStores, useDemoState } from "@/lib/demo/store";

/**
 * 店舗単位の画面で対象店舗を決める。
 * ヘッダーで店舗を選んでいればその店舗、「全店舗」なら画面内で選んだ店舗（初期値は先頭）。
 */
export function useStoreScope() {
  const stores = useAccessibleStores();
  const selected = useDemoState((s) => s.selectedStoreId);
  const [picked, setPicked] = useState<string | null>(null);
  const storeId =
    selected !== "all" ? selected : picked && stores.some((s) => s.id === picked) ? picked : stores[0]?.id;
  const store = stores.find((s) => s.id === storeId) ?? null;
  return { stores, store, showPicker: selected === "all" && stores.length > 1, setPicked };
}
