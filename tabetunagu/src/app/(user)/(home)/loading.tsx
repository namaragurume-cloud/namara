/** ホームの読み込み中の表示（レイアウトが崩れないよう、見出しとカードの枠だけを出す。アニメーションは控えめ） */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">読み込み中</span>
      <div className="space-y-2 pt-1">
        <div className="h-7 w-3/4 rounded-lg bg-canvas" />
        <div className="h-4 w-1/2 rounded-lg bg-canvas" />
        <div className="h-14 rounded-2xl bg-canvas" />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-2xl bg-canvas" />
        ))}
      </div>
      <div className="flex gap-3 overflow-hidden">
        {[0, 1].map((i) => (
          <div key={i} className="w-[72%] max-w-[280px] shrink-0 overflow-hidden rounded-2xl border border-line">
            <div className="aspect-[4/3] bg-canvas" />
            <div className="space-y-2 p-3.5">
              <div className="h-3 w-1/2 rounded bg-canvas" />
              <div className="h-4 w-4/5 rounded bg-canvas" />
              <div className="h-5 w-1/3 rounded bg-canvas" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
