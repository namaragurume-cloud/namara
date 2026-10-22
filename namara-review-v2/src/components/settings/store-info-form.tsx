"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoNow, dispatch, useCurrentMember } from "@/lib/demo/store";
import { canOnStore } from "@/lib/permissions";
import type { Store } from "@/lib/types";

const FIELDS = [
  ["name", "店舗名", "例：炭火焼肉 なまら亭 すすきの本店", true],
  ["shortName", "略称（一覧で表示）", "例：なまら亭 すすきの", true],
  ["genre", "ジャンル", "例：焼肉", false],
  ["area", "エリア", "例：札幌市中央区", false],
  ["address", "住所", "", false],
  ["phone", "電話番号", "", false],
  ["hours", "営業時間", "", false],
] as const;

type FieldKey = (typeof FIELDS)[number][0];

export function StoreInfoForm({ store }: { store: Store }) {
  const me = useCurrentMember();
  const canEdit = canOnStore(me, "store.edit", store);
  const [values, setValues] = useState<Record<FieldKey, string>>(() => ({
    name: store.name,
    shortName: store.shortName,
    genre: store.genre,
    area: store.area,
    address: store.address,
    phone: store.phone,
    hours: store.hours,
  }));
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  function save(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Partial<Record<FieldKey, string>> = {};
    for (const [key, label, , required] of FIELDS) {
      const value = values[key].trim();
      if (required && !value) nextErrors[key] = `${label}を入力してください`;
      if (value.length > 100) nextErrors[key] = "100文字以内で入力してください";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const patch = Object.fromEntries(FIELDS.map(([key]) => [key, values[key].trim()])) as Record<FieldKey, string>;
    if (dispatch({ type: "updateStore", storeId: store.id, patch, at: demoNow() })) toast.success("店舗情報を保存しました");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>店舗情報</CardTitle>
        <CardDescription>返信文や分析レポートで使われます。Google連携後はGoogleビジネスプロフィールの情報と照合します。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} noValidate>
          <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(([key, label, placeholder, required]) => (
              <div key={key} className={key === "name" || key === "address" ? "space-y-2 sm:col-span-2" : "space-y-2"}>
                <Label htmlFor={`store-${key}`}>
                  {label}
                  {required ? <span className="text-xs text-destructive">必須</span> : null}
                </Label>
                <Input
                  id={`store-${key}`}
                  value={values[key]}
                  placeholder={placeholder}
                  aria-invalid={errors[key] ? true : undefined}
                  aria-describedby={errors[key] ? `store-${key}-error` : undefined}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                />
                {errors[key] ? (
                  <p id={`store-${key}-error`} className="text-xs text-destructive">
                    {errors[key]}
                  </p>
                ) : null}
              </div>
            ))}
          </fieldset>
          <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4">
            {!canEdit ? <p className="text-xs text-muted-foreground">店舗情報の編集はオーナー・店長のみ可能です。</p> : <span />}
            <Button type="submit" disabled={!canEdit}>
              <Save aria-hidden />
              保存する
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
