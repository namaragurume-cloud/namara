"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentMember, useDemoState } from "@/lib/demo/store";
import { useHydrated } from "@/lib/use-hydrated";
import { AppShell } from "./app-shell";
import { Logo } from "./logo";
import { OrgSlugProvider } from "./org-context";

function GateMessage({ icon: Icon, title, description }: { icon: typeof Lock; title: string; description: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Logo className="mb-4" />
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" aria-hidden />
      </span>
      <h1 className="text-xl font-bold text-primary">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      <Button asChild>
        <Link href="/login">ログイン画面へ</Link>
      </Button>
    </main>
  );
}

export function ShellSkeleton() {
  return (
    <div className="min-h-dvh lg:pl-64" aria-busy="true" aria-label="読み込み中">
      <div className="fixed inset-y-0 left-0 hidden w-64 bg-sidebar lg:block" />
      <div className="h-16 border-b bg-card" />
      <div className="mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

/**
 * 法人専用ページの入口。URL の法人と、ログイン中ユーザーの所属法人が一致する場合だけ表示する。
 * Phase 2 ではサーバー側（認証セッション＋RLS）で同じ判定を行い、データ自体を返さない。
 */
export function OrgGate({ slug, children }: { slug: string; children: React.ReactNode }) {
  const hydrated = useHydrated();
  const organization = useDemoState((s) => s.organizations.find((o) => o.slug === slug));
  const me = useCurrentMember();

  if (!hydrated) return <ShellSkeleton />;
  // 「存在しない」と「権限がない」を同じ表示にして、URLの推測で他社の契約有無や社名が分からないようにする
  if (!organization || me.organizationId !== organization.id) {
    return (
      <GateMessage
        icon={Lock}
        title="ページが見つからないか、表示する権限がありません"
        description="ご契約法人のアカウントでログインしてください。専用ページのURLは、なまらグルメからご案内したものをご利用ください。"
      />
    );
  }
  return (
    <OrgSlugProvider slug={slug}>
      <AppShell>{children}</AppShell>
    </OrgSlugProvider>
  );
}
