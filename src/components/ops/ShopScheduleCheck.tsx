import { CalendarCheck } from "lucide-react";
import { SubmitButton } from "./client";
import { Card, Field, inputClass } from "./ui";
import { fmtParty } from "@/lib/ops/dates";
import type { Campaign } from "@/lib/ops/types";
import { shopScheduleCheck } from "@/app/(ops)/p/actions";

type Group = { label: string; total: number; people: { id: string; name: string; party?: number; note?: string }[] };

/** 飲食店：撮影日時を確定する前の、日程のご確認（OK／変更をお願いしたい） */
export function ShopScheduleCheck({ token, campaign: c, groups }: { token: string; campaign: Campaign; groups: Group[] }) {
  const check = c.shopCheck;
  if (!check || groups.length === 0) return null;
  const answered = check.status !== "pending";
  return (
    <section id="check" className="scroll-mt-4">
      <Card
        title={
          <span className="flex items-center gap-2">
            <CalendarCheck className="size-5 text-brand" />
            撮影日程のご確認
          </span>
        }
        className={answered ? undefined : "border-brand/40"}
      >
        <p className="text-sm">{answered ? "ご確認いただいた日程です。" : "下記の日程で調整しております。この日程で問題ないか、ご確認をお願いいたします。"}</p>
        <ul className="mt-3 space-y-3">
          {groups.map((g) => (
            <li key={g.label} className="rounded-xl border border-line p-3">
              <p className="font-bold">
                {g.label}
                <span className="ml-2 text-xs font-normal text-muted">来店 計{g.total}名</span>
              </p>
              <ul className="mt-1 space-y-0.5 pl-2 text-sm">
                {g.people.map((p) => (
                  <li key={p.id}>
                    ・<b>{p.name}</b>さん <span className="text-xs text-muted">{fmtParty(p.party)}</span>
                    {p.note && <span className="ml-1.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">{p.note}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        {answered ? (
          <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${check.status === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
            {check.status === "ok" ? "「この日程でOK」とご回答いただきました。ありがとうございます。" : `「変更をお願いしたい」とご回答いただきました：${check.comment ?? ""}`}
          </p>
        ) : null}

        <details className="mt-3" open={!answered}>
          <summary className={answered ? "cursor-pointer text-xs text-muted" : "sr-only"}>回答を変更する</summary>
          <form action={shopScheduleCheck.bind(null, token)} className="mt-2 space-y-3">
            <Field label="ご確認いただいた方のお名前（任意）">
              <input name="name" maxLength={40} defaultValue={check.name && check.name !== "（代理で記録）" ? check.name : ""} className={inputClass} />
            </Field>
            <SubmitButton name="decision" value="ok" className="w-full">
              この日程でOK
            </SubmitButton>
            <div className="rounded-xl border border-line p-3">
              <Field label="変更をお願いしたい場合は、ご希望をご記入ください">
                <textarea name="comment" rows={3} placeholder="例：11/25は14時以降にしてほしい／25日は3名まで" className={inputClass} />
              </Field>
              <SubmitButton name="decision" value="change" variant="outline" className="mt-2 w-full">
                変更をお願いしたい
              </SubmitButton>
            </div>
          </form>
        </details>
      </Card>
    </section>
  );
}
