import type { ReactNode } from "react";

/**
 * 法務ページの枠組み。内容は専門家の確認前のドラフトであることを必ず表示する。
 * 【要記入】【要確認】の箇所は運営者が記入・確認する（推測で埋めない）。
 */
export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: ReactNode }) {
  return (
    <article className="space-y-5 pb-6">
      <div
        role="note"
        data-testid="legal-draft"
        className="rounded-xl border-2 border-dashed border-clay/50 bg-clay-soft px-4 py-3 text-[13px] font-semibold leading-relaxed text-clay"
      >
        ドラフト（専門家確認前）です。内容は確定していません。【要記入】【要確認】の箇所は公開前に運営者が記入・確認します。
      </div>
      <header>
        <h1 className="text-[22px] font-bold">{title}</h1>
        <p className="mt-1 text-[12px] text-muted">最終更新日：{updated ?? "【要記入】"}</p>
      </header>
      <div className="space-y-5 text-[13.5px] leading-[1.9] text-ink-2 [&_h2]:mb-1.5 [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-ink">
        {children}
      </div>
    </article>
  );
}

export function Fill({ children = "【要記入】" }: { children?: ReactNode }) {
  return <span className="rounded bg-sand px-1 font-semibold text-clay">{children}</span>;
}
