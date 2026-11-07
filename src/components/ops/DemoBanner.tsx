import { isDemo } from "@/lib/ops/demo-flag";

/** デモ環境であることの表示 */
export function DemoBanner({ who = "admin" }: { who?: "admin" | "creator" | "restaurant" }) {
  if (!isDemo()) return null;
  const text =
    who === "admin"
      ? "デモ環境です。店舗・発信者・数値はすべて架空のサンプルで、LINE・メールは実際には送信されません（送信履歴に記録だけされます）。変更はしばらくすると元に戻ります。"
      : who === "creator"
        ? "デモ：発信者に見えるページの例です。回答やスクショ送信を試せます（スクショは読み取らず、サンプルの数値が入ります）。"
        : "デモ：飲食店に見えるページの例です。";
  return <p className="bg-amber-300 px-4 py-2 text-center text-xs font-bold leading-relaxed text-amber-950 print:hidden">{text}</p>;
}
