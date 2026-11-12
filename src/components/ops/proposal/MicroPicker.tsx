import { microOptions } from "@/lib/ops/proposal";
import type { ReachEstimate } from "@/lib/ops/reach";
import { fmtReach } from "@/lib/ops/reach";
import { cn } from "@/lib/utils";

/** マイクロインフルエンサー（フォロワー1万人未満）の定額プランを選ぶ（発信者は指定しない） */
export function MicroPicker({ value, perPerson }: { value?: number; perPerson?: Pick<ReachEstimate, "value"> }) {
  const opts = [{ people: 0, amount: 0, recommended: false }, ...microOptions];
  return (
    <fieldset>
      <legend className="text-sm font-bold">マイクロインフルエンサー（フォロワー1万人未満）</legend>
      <p className="text-xs text-muted">人数だけ選びます（発信者はこちらで調整）。料金はホームページの料金表と同じ定額です（税別）。</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {opts.map((o) => (
          <label
            key={o.people}
            className={cn("relative flex cursor-pointer flex-col rounded-xl border border-line bg-white px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/5")}
          >
            <input
              type="radio"
              name="microPeople"
              value={o.people || ""}
              defaultChecked={(value ?? 0) === o.people}
              data-price={o.amount}
              data-reach={perPerson && o.people ? Math.round(perPerson.value * o.people) : 0}
              data-people={o.people}
              className="sr-only"
            />
            {o.people ? (
              <>
                <b>{o.people}名調整</b>
                <span className="num font-extrabold text-brand">{(o.amount / 10000).toLocaleString("ja-JP")}万円</span>
                {perPerson && <span className="text-[11px] text-emerald-700">予想リーチ 約{fmtReach(perPerson.value * o.people)}人</span>}
                {o.recommended && <span className="absolute -top-2 right-2 rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">おすすめ</span>}
              </>
            ) : (
              <>
                <b>なし</b>
                <span className="text-xs text-muted">指定アカウントのみ</span>
              </>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
