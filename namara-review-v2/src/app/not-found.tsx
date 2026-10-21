import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" aria-hidden />
      </span>
      <h1 className="text-xl font-bold text-primary">ページが見つかりません</h1>
      <p className="text-sm text-muted-foreground">URLが間違っているか、ページが移動した可能性があります。</p>
      <Button asChild>
        <Link href="/dashboard">ダッシュボードへ戻る</Link>
      </Button>
    </main>
  );
}
