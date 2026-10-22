"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, ChevronRight, LogIn } from "lucide-react";

import { DemoNotice } from "@/components/common/demo-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLANS, ROLE_LABELS } from "@/lib/constants";
import { dispatch, useDemoState } from "@/lib/demo/store";
import type { Member } from "@/lib/types";

export function LoginForm() {
  const router = useRouter();
  const organizations = useDemoState((s) => s.organizations);
  const members = useDemoState((s) => s.members);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function enter(member: Member) {
    const organization = organizations.find((o) => o.id === member.organizationId);
    if (!organization) return;
    dispatch({ type: "switchUser", userId: member.id });
    // ログイン後は所属法人の専用ページへ
    router.push(`/o/${organization.slug}/dashboard`);
  }

  return (
    <div className="mt-6 space-y-6">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          // Phase 2 で Supabase Auth に置き換える。現在はメールアドレスが一致すればパスワードを確認せずに入る
          const member = members.find((m) => m.email.toLowerCase() === email.trim().toLowerCase() && !m.invited);
          if (!member) {
            setError("メールアドレスまたはパスワードが正しくありません");
            return;
          }
          enter(member);
        }}
        noValidate
      >
        <div className="space-y-2">
          <Label htmlFor="email">メールアドレス</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            aria-invalid={error ? true : undefined}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">パスワード</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="デモでは入力不要"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" size="lg">
          <LogIn aria-hidden />
          ログイン
        </Button>
      </form>

      <section aria-labelledby="demo-accounts" className="space-y-3">
        <h2 id="demo-accounts" className="text-sm font-semibold">
          デモ用アカウントで試す
        </h2>
        <p className="text-xs text-muted-foreground">
          法人ごとに専用ページとデータが分かれています。別の法人のページは表示できません。
        </p>
        {organizations.map((org) => (
          <div key={org.id} className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b bg-muted/60 px-3 py-2">
              <Building2 className="size-4 text-brand" aria-hidden />
              <span className="text-sm font-semibold">{org.name}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{PLANS[org.plan].name}</span>
            </div>
            <ul>
              {members
                .filter((m) => m.organizationId === org.id && !m.invited)
                .map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => enter(m)}
                      className="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                        {m.name.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{m.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{ROLE_LABELS[m.role]}</span>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      <DemoNotice>
        Phase 1 ではパスワードの確認は行いません。Phase 2 で Supabase Auth による認証を実装し、ログイン後は所属法人の専用ページ（/o/法人ID）だけが開けるようにします。
      </DemoNotice>
    </div>
  );
}
