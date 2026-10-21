"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Store } from "@/lib/types";

/** 「全店舗」表示中でも、店舗単位の設定画面では対象店舗を1つ選ぶ */
export function StoreScopeSelect({
  stores,
  value,
  onChange,
}: {
  stores: Store[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (stores.length <= 1) return null;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-72" aria-label="設定する店舗">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {stores.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
