"use client";

import { useEffect, useState } from "react";

/** フォーム内でチェックした発信者の人数と料金の合計（税別）を表示 */
export function SelectedTotal({ formId }: { formId: string }) {
  const [state, setState] = useState({ n: 0, sum: 0, missing: 0 });
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    const update = () => {
      const checked = [...form.querySelectorAll<HTMLInputElement>('input[name="creatorId"]:checked')];
      setState({
        n: checked.length,
        sum: checked.reduce((n, el) => n + Number(el.dataset.price || 0), 0),
        missing: checked.filter((el) => !Number(el.dataset.price)).length,
      });
    };
    update();
    form.addEventListener("change", update);
    return () => form.removeEventListener("change", update);
  }, [formId]);
  return (
    <p className="text-sm">
      選択中 <b className="num">{state.n}</b>名・料金の合計 <b className="num">{state.sum.toLocaleString("ja-JP")}円</b>（税別）
      {state.missing > 0 && <span className="ml-2 text-xs text-amber-700">料金未設定が{state.missing}名います</span>}
    </p>
  );
}
