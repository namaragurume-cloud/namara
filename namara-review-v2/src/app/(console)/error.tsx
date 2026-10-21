"use client";

import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ConsoleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
        <TriangleAlert className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-bold">画面の表示中にエラーが発生しました</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        時間をおいて再度お試しください。解決しない場合は、なまらグルメのサポートまでご連絡ください。
      </p>
      {error.digest ? <p className="mt-2 text-xs text-muted-foreground">エラーID: {error.digest}</p> : null}
      <Button className="mt-6" onClick={reset}>
        再読み込み
      </Button>
    </Card>
  );
}
