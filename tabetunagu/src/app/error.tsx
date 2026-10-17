"use client";

import { Button } from "@/components/ui/Button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-[20px] font-bold">うまく表示できませんでした</h1>
      <p className="mt-2 text-[13px] text-muted">時間をおいて、もう一度お試しください。</p>
      <Button className="mt-6" onClick={reset}>
        再読み込み
      </Button>
    </main>
  );
}
