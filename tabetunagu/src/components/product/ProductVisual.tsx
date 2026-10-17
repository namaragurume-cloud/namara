import { Cake, Croissant, Hotel, Package, Salad, Soup } from "lucide-react";
import Image from "next/image";
import { cn } from "../ui/cn";

const PLACEHOLDER: Record<string, { bg: string; Icon: typeof Croissant }> = {
  bread: { bg: "from-[#f3e7d3] to-[#e9d6b8]", Icon: Croissant },
  bento: { bg: "from-[#efe8dc] to-[#e2d6c3]", Icon: Soup },
  deli: { bg: "from-[#e6ece2] to-[#d3dfcd]", Icon: Salad },
  sweets: { bg: "from-[#f4e6e3] to-[#ead3cf]", Icon: Cake },
  hotel: { bg: "from-[#e9e7e3] to-[#d8d4cd]", Icon: Hotel },
  other: { bg: "from-[#efebe4] to-[#e1dbd0]", Icon: Package },
};

/** 商品写真。写真がなければカテゴリーの色とアイコンで静かなプレースホルダーを出す。 */
export function ProductVisual({
  imageUrl,
  category,
  alt,
  sizes,
  priority,
  className,
  dimmed,
}: {
  imageUrl: string | null;
  category: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  dimmed?: boolean;
}) {
  const p = PLACEHOLDER[category] ?? PLACEHOLDER.other;
  return (
    <div className={cn("relative overflow-hidden bg-sand", className)}>
      {imageUrl ? (
        <Image src={imageUrl} alt={alt} fill sizes={sizes} priority={priority} className={cn("object-cover", dimmed && "opacity-60")} />
      ) : (
        <div className={cn("absolute inset-0 flex items-center justify-center bg-gradient-to-br", p.bg, dimmed && "opacity-60")} aria-hidden>
          <p.Icon className="h-[34%] w-[34%] max-h-16 max-w-16 text-forest/55" strokeWidth={1.2} />
        </div>
      )}
    </div>
  );
}
