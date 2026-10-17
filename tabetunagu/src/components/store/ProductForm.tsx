"use client";

import { ImagePlus, Sparkles } from "lucide-react";
import Image from "next/image";
import { useActionState, useRef, useState, useTransition } from "react";
import { createProductAction, generateDescriptionAction } from "@/app/actions/store";
import { CATEGORIES } from "@/lib/categories";
import type { PriceSuggestion } from "@/lib/price-suggest";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";
import { Notice } from "../ui/Section";
import { SubmitButton } from "../ui/SubmitButton";

export type ProductFormDefaults = {
  name: string;
  description: string;
  category: string;
  isBox: boolean;
  originalPrice: number | "";
  rescuePrice: number | "";
  quantity: number;
  pickupDate: string;
  pickupStart: string;
  pickupEnd: string;
  imageUrl: string;
  templateId: string;
};

/** 写真をブラウザで縮小（長辺1280px・JPEG）してからアップロードする */
async function resizeImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
}

export function ProductForm({
  storeId,
  defaults,
  today,
  tomorrow,
  priceSuggestion,
  plan,
  uploadsAvailable,
}: {
  storeId: string;
  defaults: ProductFormDefaults;
  today: string;
  tomorrow: string;
  priceSuggestion: PriceSuggestion | null;
  plan: "free" | "standard";
  uploadsAvailable: boolean;
}) {
  const [state, action] = useActionState(createProductAction, null);
  const [isBox, setIsBox] = useState(defaults.isBox);
  const [name, setName] = useState(defaults.name);
  const [category, setCategory] = useState(defaults.category);
  const [original, setOriginal] = useState<string>(String(defaults.originalPrice));
  const [price, setPrice] = useState<string>(String(defaults.rescuePrice));
  const [quantity, setQuantity] = useState<number>(defaults.quantity);
  const [pickupEnd, setPickupEnd] = useState(defaults.pickupEnd);
  const [description, setDescription] = useState(defaults.description);
  const [keywords, setKeywords] = useState("");
  const [preview, setPreview] = useState<string | null>(defaults.imageUrl || null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const errors = state?.fieldErrors ?? {};

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const resized = await resizeImage(file);
    const dt = new DataTransfer();
    dt.items.add(resized);
    input.files = dt.files;
    setPreview(URL.createObjectURL(resized));
  }

  function generate() {
    setAiMessage(null);
    startGenerating(async () => {
      const res = await generateDescriptionAction({
        storeId,
        name,
        isBox,
        category,
        rescuePrice: Number(price),
        originalPrice: original ? Number(original) : null,
        quantity,
        pickupEnd,
        keywords: keywords || undefined,
      });
      if (res.ok) {
        setDescription(res.text);
        setAiMessage(res.provider === "openai" ? "AIが紹介文を作りました。必要に応じて直してください。" : "紹介文のひな形を作りました。必要に応じて直してください。");
      } else {
        setAiMessage(res.message);
      }
    });
  }

  const err = (key: string) => (errors[key] ? <p className="mt-1 text-[12px] text-clay">{errors[key]}</p> : null);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="templateId" value={defaults.templateId} />
      <input type="hidden" name="imageUrl" value={preview && !preview.startsWith("blob:") ? preview : ""} />
      <input type="hidden" name="isBox" value={isBox ? "on" : ""} />

      <div className="grid grid-cols-2 gap-2 rounded-full bg-canvas p-1 text-[13px] font-semibold">
        {[
          { v: true, label: "食べつなぎBOX" },
          { v: false, label: "単品" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={isBox === o.v}
            onClick={() => {
              setIsBox(o.v);
              if (o.v && !name) setName("本日の食べつなぎBOX");
            }}
            className={cn("rounded-full py-2", isBox === o.v ? "bg-paper text-ink shadow-sm" : "text-muted")}
          >
            {o.label}
          </button>
        ))}
      </div>
      {isBox && <p className="-mt-3 text-[12px] text-muted">中身は当日のお楽しみ。定価販売に影響しにくく、毎日続けやすい出し方です。</p>}

      <div>
        <label htmlFor="name" className="label">
          商品名
        </label>
        <input id="name" name="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="field" placeholder="本日の食べつなぎBOX" />
        {err("name")}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="quantity" className="label">
            数量
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={999}
            required
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="field tnum"
          />
          {err("quantity")}
        </div>
        <div>
          <label htmlFor="originalPrice" className="label">
            通常価格（相当）
          </label>
          <input
            id="originalPrice"
            name="originalPrice"
            type="number"
            inputMode="numeric"
            min={1}
            required
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            className="field tnum"
            placeholder="1500"
          />
          {err("originalPrice")}
        </div>
        <div>
          <label htmlFor="rescuePrice" className="label">
            食べつなぎ価格
          </label>
          <input
            id="rescuePrice"
            name="rescuePrice"
            type="number"
            inputMode="numeric"
            min={1}
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="field tnum font-semibold"
            placeholder="800"
          />
          {err("rescuePrice")}
        </div>
      </div>

      {plan === "standard" && priceSuggestion ? (
        <div className="rounded-2xl border border-forest/20 bg-leaf-soft px-4 py-3 text-[12.5px] text-forest">
          <p className="flex items-center gap-1.5 font-bold">
            <Sparkles className="h-4 w-4" aria-hidden />
            AI値引き提案：{priceSuggestion.suggestedPrice.toLocaleString("ja-JP")}円
            {priceSuggestion.direction !== "keep" && (
              <button type="button" onClick={() => setPrice(String(priceSuggestion.suggestedPrice))} className="ml-auto rounded-full bg-paper px-3 py-1 text-[12px] font-semibold">
                この価格にする
              </button>
            )}
          </p>
          <p className="mt-1 leading-relaxed">{priceSuggestion.reason}</p>
        </div>
      ) : plan === "free" ? (
        <p className="text-[12px] text-muted">STANDARD プランでは、販売履歴からAIが価格を提案します。</p>
      ) : null}

      <div>
        <span className="label">受取時間</span>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <input aria-label="受取開始" name="pickupStart" type="time" required defaultValue={defaults.pickupStart} step={900} className="field tnum" />
          <span className="text-muted">〜</span>
          <input aria-label="受取終了" name="pickupEnd" type="time" required value={pickupEnd} onChange={(e) => setPickupEnd(e.target.value)} step={900} className="field tnum" />
        </div>
        <div className="mt-2 flex gap-4 text-[13px]">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="pickupDate" value={today} defaultChecked={defaults.pickupDate !== tomorrow} className="accent-[var(--forest)]" />
            今日
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="pickupDate" value={tomorrow} defaultChecked={defaults.pickupDate === tomorrow} className="accent-[var(--forest)]" />
            明日
          </label>
        </div>
        {err("pickupStart") || err("pickupEnd") || err("pickupDate")}
      </div>

      <div>
        <span className="label">写真（任意）</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!uploadsAvailable}
            className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-canvas text-muted disabled:opacity-50"
          >
            {preview ? (
              <Image src={preview} alt="商品写真のプレビュー" fill sizes="96px" className="object-cover" unoptimized={preview.startsWith("blob:")} />
            ) : (
              <ImagePlus className="h-7 w-7" aria-hidden />
            )}
          </button>
          <div className="text-[12px] leading-relaxed text-muted">
            {uploadsAvailable ? "スマホで撮ってそのまま選べます。自動で軽くしてから送ります。" : "画像の保存先（Supabase Storage）が未設定のため、写真は使えません。"}
            {preview && (
              <button
                type="button"
                className="ml-2 font-semibold text-clay"
                onClick={() => {
                  setPreview(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                写真を外す
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" name="image" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={onFile} />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="description" className="label mb-0">
            紹介文
          </label>
          <Button type="button" variant="secondary" size="sm" onClick={generate} disabled={generating || !name || !price}>
            <Sparkles className="h-4 w-4 text-forest" aria-hidden />
            {generating ? "作成中…" : "AIで文章を作る"}
          </Button>
        </div>
        <input
          aria-label="AIへのひとこと（任意）"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          maxLength={100}
          className="field mb-2 text-[13px]"
          placeholder="ひとこと（任意）例：今日はクロワッサン多め"
        />
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={600}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="field leading-relaxed"
          placeholder="本日限定の食べつなぎBOX。今日店頭に並んだパンを詰め合わせました。"
        />
        {aiMessage && <p className="mt-1 text-[12px] text-forest">{aiMessage}</p>}
        {err("description")}
      </div>

      <div>
        <label htmlFor="category" className="label">
          カテゴリー
        </label>
        <select id="category" name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="field">
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-[13px]">
        <input type="checkbox" name="saveTemplate" defaultChecked={Boolean(defaults.templateId) || isBox} className="h-4 w-4 accent-[var(--forest)]" />
        「いつもの出品」として保存する（次回からワンタップで出品できます）
      </label>

      {state && !state.ok && <Notice tone="error">{state.message}</Notice>}
      <SubmitButton size="lg" className="w-full" pendingLabel="公開しています…">
        確認して公開する
      </SubmitButton>
    </form>
  );
}
