"use client";

import { useState } from "react";
import { ShotUploader } from "./ShotUploader";
import { inputClass } from "./ui";

type Row = { id: string; label: string; shots: { id: string; url: string }[] };

/** 案件ページ：DMなどで受け取ったスクショを、発信者を選んでまとめて追加する */
export function AdminShotDrop({ rows, canAnalyze }: { rows: Row[]; canAnalyze: boolean }) {
  const [id, setId] = useState(rows[0]?.id ?? "");
  const row = rows.find((r) => r.id === id);
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-bold">誰のスクショですか？</span>
        <select value={id} onChange={(e) => setId(e.target.value)} className={inputClass}>
          {rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      {row && <ShotUploader key={row.id} assignmentId={row.id} shots={row.shots} canAnalyze={canAnalyze} pasteAndDrop />}
    </div>
  );
}
