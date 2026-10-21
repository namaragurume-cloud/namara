"use client";

import { Check, ChevronsUpDown, Store as StoreIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { dispatch, useAccessibleStores, useDemoState } from "@/lib/demo/store";
import { cn } from "@/lib/utils";

export function StoreSwitcher({ className }: { className?: string }) {
  const stores = useAccessibleStores();
  const selected = useDemoState((s) => s.selectedStoreId);
  const current = stores.find((s) => s.id === selected);
  const label = current ? current.shortName : stores.length > 1 ? `全店舗（${stores.length}店舗）` : stores[0]?.shortName;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-left text-sm shadow-xs hover:bg-muted",
          className,
        )}
        aria-label="表示する店舗を切り替える"
      >
        <StoreIcon className="size-4 shrink-0 text-brand" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>表示する店舗</DropdownMenuLabel>
        {stores.length > 1 ? (
          <DropdownMenuItem onSelect={() => dispatch({ type: "selectStore", storeId: "all" })}>
            <Check className={cn("text-brand", selected === "all" ? "opacity-100" : "opacity-0")} />
            全店舗
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        {stores.map((store) => (
          <DropdownMenuItem key={store.id} onSelect={() => dispatch({ type: "selectStore", storeId: store.id })}>
            <Check className={cn("text-brand", selected === store.id ? "opacity-100" : "opacity-0")} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{store.name}</span>
              <span className="text-xs text-muted-foreground">
                {store.genre}・{store.area}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
