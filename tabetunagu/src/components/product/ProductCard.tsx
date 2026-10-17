import { Clock } from "lucide-react";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { areaLabel } from "@/lib/categories";
import { pickupLabel } from "@/lib/format";
import type { ProductCard as Product } from "@/lib/types";
import { Badge } from "../ui/Badge";
import { cn } from "../ui/cn";
import { Price } from "../ui/Price";
import { ProductVisual } from "./ProductVisual";

function availability(p: Product) {
  const soldOut = p.status === "sold_out" || p.remaining <= 0;
  return { soldOut, few: !soldOut && p.remaining <= 2 };
}

export function Remaining({ product, className }: { product: Product; className?: string }) {
  const { soldOut, few } = availability(product);
  if (soldOut) return <span className={cn("shrink-0 text-[12px] font-semibold text-muted", className)}>すべてつながりました</span>;
  return (
    <span className={cn("tnum shrink-0 whitespace-nowrap text-[12px] font-semibold", few ? "text-clay" : "text-forest", className)}>
      残り{product.remaining}
      {product.isBox ? "BOX" : "点"}
    </span>
  );
}

/** 縦型カード（ホームのおすすめ） */
export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const { soldOut } = availability(product);
  return (
    <Link href={`/products/${product.id}`} className="group block overflow-hidden rounded-2xl border border-line bg-paper">
      <div className="relative">
        <ProductVisual
          imageUrl={product.imageUrl}
          category={product.category}
          alt={product.name}
          sizes="(max-width: 640px) 75vw, 280px"
          priority={priority}
          dimmed={soldOut}
          className="aspect-[4/3]"
        />
        <div className="absolute left-2.5 top-2.5 flex gap-1.5">
          {product.isBox && <Badge tone="dark">{brand.boxLabel}</Badge>}
        </div>
      </div>
      <div className="space-y-2 p-3.5">
        <div>
          <p className="truncate text-[12px] text-muted">
            {product.storeName}・{areaLabel(product.areaId)}
          </p>
          <p className="mt-0.5 line-clamp-1 text-[15px] font-bold text-ink">{product.name}</p>
        </div>
        <div className="flex items-end justify-between gap-2">
          <Price price={product.rescuePrice} original={product.originalPrice} size="sm" />
          <Remaining product={product} />
        </div>
        <p className="flex items-center gap-1 text-[12px] text-ink-2">
          <Clock className="h-3.5 w-3.5 text-muted" aria-hidden />
          <span className="tnum">{pickupLabel(product.pickupStartAt, product.pickupEndAt)}</span>
        </p>
      </div>
    </Link>
  );
}

/** 横型の行（一覧） */
export function ProductRow({ product, priority }: { product: Product; priority?: boolean }) {
  const { soldOut } = availability(product);
  return (
    <Link href={`/products/${product.id}`} className="flex gap-3 rounded-2xl border border-line bg-paper p-2.5 transition-colors hover:bg-canvas">
      <ProductVisual
        imageUrl={product.imageUrl}
        category={product.category}
        alt={product.name}
        sizes="112px"
        priority={priority}
        dimmed={soldOut}
        className="aspect-square w-[104px] shrink-0 rounded-xl"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5 pr-1">
        <div>
          <div className="flex items-center gap-1.5">
            {product.isBox && <Badge tone="dark" className="px-2 text-[10px] leading-4">BOX</Badge>}
            <p className="truncate text-[11px] text-muted">
              {product.storeName}・{areaLabel(product.areaId)}
            </p>
          </div>
          <p className="mt-1 line-clamp-2 text-[14px] font-bold leading-snug text-ink">{product.name}</p>
        </div>
        <div className="mt-1.5 flex items-end justify-between gap-2">
          <Price price={product.rescuePrice} original={product.originalPrice} size="sm" showLabel={false} />
          <Remaining product={product} />
        </div>
        <p className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-2">
          <Clock className="h-3.5 w-3.5 text-muted" aria-hidden />
          <span className="tnum">{pickupLabel(product.pickupStartAt, product.pickupEndAt)}</span>
        </p>
      </div>
    </Link>
  );
}
