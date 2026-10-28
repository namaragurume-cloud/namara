import Image from "next/image";
import { UserRound } from "lucide-react";
import type { Creator } from "@/data/creators";

/** 小さい発信者カード（ネットワーク発信者用） */
export function CreatorMini({ creator }: { creator: Creator }) {
  const label = creator.name ?? `@${creator.account}`;
  return (
    <a
      href={creator.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2.5 rounded-2xl border border-line bg-white p-2.5 sm:gap-3 sm:p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_16px_30px_-20px_rgba(0,0,0,0.3)]"
    >
      <span className="relative size-10 shrink-0 sm:size-12 overflow-hidden rounded-full bg-mist ring-1 ring-line">
        {creator.image ? (
          <Image src={creator.image} alt="" fill sizes="48px" className="object-cover" />
        ) : (
          <UserRound size={24} className="absolute inset-0 m-auto text-ink/20" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-bold sm:text-[13px] transition-colors group-hover:text-brand">{label}</span>
        <span className="block text-[11px] text-muted">Instagram</span>
      </span>
      <span className="sr-only">（新しいタブで開きます）</span>
    </a>
  );
}
