"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/constants";
import { dispatch, resetDemo, useCurrentMember, useDemoState } from "@/lib/demo/store";
import { cn } from "@/lib/utils";

export function UserMenu({ className, compact = false }: { className?: string; compact?: boolean }) {
  const me = useCurrentMember();
  const members = useDemoState((s) => s.members);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted",
            className,
          )}
          aria-label="アカウントメニュー"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {me.name.slice(0, 1)}
          </span>
          {compact ? null : (
            <span className="hidden min-w-0 flex-col leading-tight md:flex">
              <span className="truncate font-medium">{me.name}</span>
              <span className="text-xs text-muted-foreground">{ROLE_LABELS[me.role]}</span>
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-foreground">
            <span className="block text-sm font-semibold">{me.name}</span>
            <span className="block text-xs font-normal text-muted-foreground">{me.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>デモ：ログインユーザーを切り替え</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={me.id} onValueChange={(id) => dispatch({ type: "switchUser", userId: id })}>
            {members
              .filter((m) => !m.invited)
              .map((m) => (
                <DropdownMenuRadioItem key={m.id} value={m.id}>
                  <UserRound className="size-4 text-muted-foreground" aria-hidden />
                  <span className="flex-1">{m.name}</span>
                  <span className="text-xs text-muted-foreground">{ROLE_LABELS[m.role]}</span>
                </DropdownMenuRadioItem>
              ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck />
              運営管理画面（なまらグルメ）
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setConfirmReset(true)}>
            <RotateCcw />
            デモデータを初期状態に戻す
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/login">
              <LogOut />
              ログアウト
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>デモデータを初期状態に戻しますか？</DialogTitle>
            <DialogDescription>
              このブラウザに保存された返信案・設定の変更がすべて消え、サンプルデータに戻ります。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">キャンセル</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                resetDemo();
                setConfirmReset(false);
                toast.success("デモデータを初期状態に戻しました");
              }}
            >
              初期状態に戻す
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
