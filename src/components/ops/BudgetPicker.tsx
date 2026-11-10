"use client";

import { useState } from "react";
import { buttonClass, inputClass } from "./ui";

const UNIT = 1000; // 1,000円単位で計算

/**
 * 予算（税込）から、予想リーチが一番大きくなる発信者の組み合わせを選んでチェックを入れる。
 * 対象：料金と予想リーチの両方がある発信者（チェックボックスの data-price / data-reach）
 */
export function BudgetPicker({ formId, taxRate, fixedFee }: { formId: string; taxRate: number; fixedFee: number }) {
  const [budget, setBudget] = useState("");
  const [result, setResult] = useState("");

  function pick() {
    const form = document.getElementById(formId);
    if (!form) return;
    const yen = Number(budget.replace(/[^\d]/g, ""));
    if (!yen) return setResult("予算を入力してください");
    const cap = Math.floor((yen / (1 + taxRate / 100) - fixedFee) / UNIT);
    const boxes = [...form.querySelectorAll<HTMLInputElement>('input[name="creatorId"]')];
    const items = boxes
      .map((el) => ({ el, price: Number(el.dataset.price || 0), reach: Number(el.dataset.reach || 0) }))
      .filter((x) => x.price > 0 && x.reach > 0);
    if (cap <= 0 || items.length === 0) return setResult(items.length === 0 ? "料金と予想リーチの両方がある発信者がいません" : "予算が固定費・消費税を下回っています");
    // 0/1ナップサック（重さ＝料金、価値＝予想リーチ）
    const best = new Array<number>(cap + 1).fill(0);
    const keep = items.map(() => new Uint8Array(cap + 1));
    items.forEach((it, i) => {
      const w = Math.ceil(it.price / UNIT);
      for (let b = cap; b >= w; b--) {
        if (best[b - w] + it.reach > best[b]) {
          best[b] = best[b - w] + it.reach;
          keep[i][b] = 1;
        }
      }
    });
    const chosen = new Set<HTMLInputElement>();
    let b = cap;
    for (let i = items.length - 1; i >= 0; i--) {
      if (keep[i][b]) {
        chosen.add(items[i].el);
        b -= Math.ceil(items[i].price / UNIT);
      }
    }
    for (const el of boxes) el.checked = chosen.has(el);
    form.dispatchEvent(new Event("change", { bubbles: true }));
    setResult(chosen.size ? `予想リーチが一番大きくなる${chosen.size}名を選びました（下の合計を確認してください）` : "この予算で選べる発信者がいません");
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
      <p className="text-sm font-bold">予算から選ぶ</p>
      <p className="text-xs text-muted">予算（税込）を入れると、その中で予想リーチが一番大きくなる組み合わせにチェックを入れます。あとから手で変えられます。</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              pick();
            }
          }}
          inputMode="numeric"
          placeholder="例：200000"
          aria-label="予算（税込・円）"
          className={`${inputClass} w-40`}
        />
        <button type="button" onClick={pick} className={buttonClass("outline", "sm")}>
          この予算で選ぶ
        </button>
      </div>
      {result && <p className="mt-1 text-xs text-emerald-800">{result}</p>}
    </div>
  );
}
