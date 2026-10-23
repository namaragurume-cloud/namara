import { Clock } from "lucide-react";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { areaLabel } from "@/lib/categories";
import { discountOf, pickupDeadline, remainingLabel } from "@/lib/deals";
import { hhmm } from "@/lib/format";
import type { ProductCard as Product } from "@/lib/types";
import { ProductVisual } from "../product/ProductVisual";
import { cn } from "../ui/cn";

/**
 * ホームの商品カード。一瞬で「買う理由」が分かるように、写真・お得率・価格・○円相当・受取時間・残りを1枚にまとめる。
 * お得額（○円おトク）は商品詳細で見せる（カードは率だけにして情報を増やしすぎない）。
 * タップで商品詳細へ（ホームから直接決済には進まない）。
 */
export function DealCard({ product, now, priority }: { product: Product; now: Date; priority?: boolean }) {
  const discount = discountOf(product.originalPrice, product.rescuePrice);
  const deadline = pickupDeadline(product.pickupEndAt, now);
  const remaining = remainingLabel(product.remaining, product.isBox);
  return (
    <Link href={`/products/${product.id}`} className="relative block overflow-hidden rounded-2xl border border-line bg-paper" data-testid="deal-card">
      <div className="relative">
        <ProductVisual
          imageUrl={product.imageUrl}
          category={product.category}
          alt={product.name}
          sizes="(max-width: 640px) 72vw, 280px"
          priority={priority}
          className="aspect-[4/3]"
        />
        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          {product.isBox ? <Tag tone="dark">{brand.boxLabel}</Tag> : <span />}
          {discount && (
            <Tag tone="deal" testId="deal-discount">
              {discount.rate}%OFF
            </Tag>
          )}
        </div>
        {deadline?.soon && (
          <div className="absolute bottom-2.5 left-2.5">
            <Tag tone="urgent" testId="deal-deadline">
              {deadline.label}
            </Tag>
          </div>
        )}
      </div>
      <div className="space-y-1.5 p-3.5">
        <p className="truncate text-[12px] text-muted">
          {product.storeName}・{areaLabel(product.areaId)}
        </p>
        <p className="line-clamp-2 min-h-[2.6em] text-[15px] font-bold leading-snug text-ink">{product.name}</p>
        <PriceLine product={product} />
        <MetaLine product={product} deadlineLabel={deadline && !deadline.soon ? deadline.label : null} remaining={remaining} />
      </div>
    </Link>
  );
}

/** 横長の行（まもなく受取終了）。受取終了までの時間を左に大きく出す */
export function DealRow({ product, now }: { product: Product; now: Date }) {
  const discount = discountOf(product.originalPrice, product.rescuePrice);
  const deadline = pickupDeadline(product.pickupEndAt, now);
  const remaining = remainingLabel(product.remaining, product.isBox);
  return (
    <Link href={`/products/${product.id}`} className="relative flex gap-3 rounded-2xl border border-line bg-paper p-2.5" data-testid="deal-row">
      <div className="relative w-[96px] shrink-0">
        <ProductVisual imageUrl={product.imageUrl} category={product.category} alt={product.name} sizes="96px" className="aspect-square rounded-xl" />
        {discount && (
          <div className="absolute left-1.5 top-1.5">
            <Tag tone="deal" small>
              {discount.rate}%OFF
            </Tag>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5 pr-1">
        <div>
          {deadline && (
            <p
              className={cn("tnum text-[13px] font-bold", deadline.soon ? "text-clay" : "text-ink-2")}
              data-testid="deal-row-deadline"
            >
              {deadline.soon ? `受取終了まで${deadline.label}` : `受取は${deadline.label}`}
            </p>
          )}
          <p className="mt-0.5 line-clamp-1 text-[14px] font-bold leading-snug text-ink">
            {product.isBox && <span className="mr-1 text-[11px] font-bold text-forest">BOX</span>}
            {product.name}
          </p>
          <p className="truncate text-[11.5px] text-muted">
            {product.storeName}・{areaLabel(product.areaId)}
          </p>
        </div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <PriceLine product={product} compact />
          {remaining && <RemainingText remaining={remaining} />}
        </div>
      </div>
    </Link>
  );
}

function PriceLine({ product, compact }: { product: Product; compact?: boolean }) {
  const hasOriginal = discountOf(product.originalPrice, product.rescuePrice) !== null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className={cn("tnum whitespace-nowrap font-semibold leading-none text-ink", compact ? "text-[17px]" : "text-[20px]")}>
        {product.rescuePrice.toLocaleString("ja-JP")}
        <span className="ml-0.5 text-[0.55em]">円</span>
      </span>
      {hasOriginal && <span className="tnum whitespace-nowrap text-[11.5px] text-muted">{product.originalPrice.toLocaleString("ja-JP")}円相当</span>}
    </p>
  );
}

function MetaLine({
  product,
  deadlineLabel,
  remaining,
}: {
  product: Product;
  deadlineLabel: string | null;
  remaining: ReturnType<typeof remainingLabel>;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-0.5 text-[12px]">
      <p className="flex min-w-0 items-center gap-1 text-ink-2">
        <Clock className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
        <span className="tnum truncate">
          {hhmm(product.pickupStartAt)}〜{hhmm(product.pickupEndAt)}
        </span>
        <span className="sr-only">{deadlineLabel ? `（${deadlineLabel}）` : ""}</span>
      </p>
      {remaining && <RemainingText remaining={remaining} />}
    </div>
  );
}

function RemainingText({ remaining }: { remaining: NonNullable<ReturnType<typeof remainingLabel>> }) {
  return (
    <span
      className={cn(
        "tnum shrink-0 whitespace-nowrap text-[12px] font-bold",
        remaining.last ? "rounded-full bg-clay-soft px-2 py-0.5 text-clay" : "text-forest",
      )}
      data-testid="deal-remaining"
    >
      {remaining.text}
    </span>
  );
}

function Tag({
  tone,
  small,
  testId,
  children,
}: {
  tone: "dark" | "deal" | "urgent";
  small?: boolean;
  testId?: string;
  children: React.ReactNode;
}) {
  const styles = { dark: "bg-ink text-white", deal: "bg-forest text-white", urgent: "bg-clay text-white" } as const;
  return (
    <span
      data-testid={testId}
      className={cn(
        "tnum inline-flex items-center rounded-full font-bold leading-none shadow-sm",
        small ? "px-1.5 py-1 text-[10px]" : "px-2.5 py-1.5 text-[11.5px]",
        styles[tone],
      )}
    >
      {children}
    </span>
  );
}
