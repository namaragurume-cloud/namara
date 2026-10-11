import Image from "next/image";
import { Camera } from "lucide-react";
import type { SiteImage } from "@/data/images";
import { cn } from "@/lib/utils";

type Props = {
  image: SiteImage;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  sizes?: string;
  tone?: "dark" | "warm" | "light";
  /** プレースホルダーのラベルを表示するか */
  showLabel?: boolean;
};

const tones = {
  dark: "bg-[radial-gradient(120%_90%_at_20%_10%,#5a2a1c_0%,#2a1712_45%,#121010_100%)]",
  warm: "bg-[radial-gradient(110%_100%_at_80%_0%,#c9873f_0%,#8a3b22_45%,#2b1610_100%)]",
  light: "bg-[radial-gradient(120%_100%_at_30%_0%,#f3efe7_0%,#e6e0d4_55%,#d8d1c3_100%)]",
};

/**
 * 写真枠。src があれば最適化画像を、なければ「仮素材」のプレースホルダーを表示します。
 * 親要素で縦横比（aspect-*）またはサイズを指定してください（CLS 防止）。
 */
export function Photo({
  image,
  className,
  imgClassName,
  priority,
  sizes = "100vw",
  tone = "dark",
  showLabel = true,
}: Props) {
  return (
    <div className={cn(!className?.includes("absolute") && "relative", "overflow-hidden", className)}>
      {image.src ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority={priority}
          sizes={sizes}
          className={cn("object-cover", imgClassName)}
        />
      ) : (
        <div
          role="img"
          aria-label={`${image.alt}（仮素材）`}
          className={cn("absolute inset-0", tones[tone], imgClassName)}
        >
          <div className="placeholder-grain absolute inset-0" />
          {showLabel && (
            <span
              className={cn(
                "absolute top-3 left-3 inline-flex max-w-[calc(100%-24px)] items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider backdrop-blur-sm",
                tone === "light" ? "bg-black/5 text-black/45" : "bg-white/10 text-white/60",
              )}
            >
              <Camera size={11} aria-hidden="true" />
              仮素材｜{image.placeholder}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
