import type { DemoControls } from "../data/types";

type Props = {
  demo: DemoControls;
  onAction: (message: string | null) => void;
  onClose: () => void;
};

/** 動作確認用（モックのときだけ表示）。お客様のQRチェックインや新規予約を擬似的に起こす */
export function DemoPanel({ demo, onAction, onClose }: Props) {
  return (
    <div className="absolute right-3 top-[calc(100%+8px)] z-40 grid w-[min(88vw,320px)] gap-2 rounded-3xl border border-stone-200 bg-white p-3 shadow-2xl">
      <p className="px-1 text-xs font-black tracking-wider text-stone-500">テスト操作（ダミーデータ）</p>
      <button
        type="button"
        className="rounded-2xl bg-brand px-4 py-3.5 text-left text-base font-black text-white"
        onClick={() => {
          const p = demo.simulateCheckin();
          onAction(p ? null : "受取待ちの予約はありません");
        }}
      >
        お客様がQRで受け取る
        <span className="block text-xs font-bold text-white/75">受取待ちの先頭1件が「受取完了」に</span>
      </button>
      <button
        type="button"
        className="rounded-2xl bg-stone-100 px-4 py-3 text-left text-base font-black"
        onClick={() => {
          const p = demo.simulateNewReservation();
          onAction(p ? null : "残りがないため、新しい予約は入りません");
        }}
      >
        新しい予約が入る
      </button>
      <button type="button" className="rounded-2xl px-4 py-2.5 text-left text-sm font-bold text-stone-600" onClick={() => { demo.reset(); onClose(); }}>
        最初の状態に戻す
      </button>
      <p className="px-1 text-xs leading-relaxed text-stone-500">受取待ちのカードを長押しすると「手動で完了にする」を試せます。</p>
    </div>
  );
}
