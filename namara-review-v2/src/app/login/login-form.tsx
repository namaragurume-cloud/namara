"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn } from "lucide-react";

import { DemoNotice } from "@/components/common/demo-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("");

  return (
    <form
      className="mt-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        // Phase 2 で Supabase Auth に置き換える。現在は認証せずにデモ画面へ移動するだけ
        router.push("/dashboard");
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
      <Button type="submit" className="w-full" size="lg">
        <LogIn aria-hidden />
        ログイン（デモ）
      </Button>
      <DemoNotice>
        Phase 1 ではログイン認証は行いません。ボタンを押すとデモ画面が開きます。Phase 2 で Supabase Auth による認証を実装します。
      </DemoNotice>
    </form>
  );
}
