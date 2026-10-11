import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CaseStudy } from "@/data/cases";

export function CaseStudyCard({ item }: { item: CaseStudy }) {
  return (
    <Link
      href={`/works/${item.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[24px] bg-white text-ink transition-all duration-500 ease-out-expo hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[radial-gradient(120%_100%_at_20%_0%,#5a2a1c_0%,#1a1311_100%)]">
        {item.image && (
          <Image
            src={item.image}
            alt=""
            fill
            sizes="(min-width: 1024px) 30vw, 80vw"
            className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 text-white">
          <p className="text-xs text-white/70">{item.metric.label}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 font-extrabold">
            <span className="num text-lg text-white/70">{item.metric.before}</span>
            <ArrowRight size={18} aria-label="から" className="self-center text-brand" />
            <span className="num text-3xl md:text-4xl">{item.metric.after}</span>
          </p>
        </div>
        <span className="num absolute top-5 left-6 text-xs font-semibold tracking-[0.25em] text-white/70">
          CASE {item.no}
        </span>
        {!item.published && (
          <span className="absolute top-4 right-4 rounded-full bg-brand px-3 py-1 text-[10px] font-bold text-white">
            非公開プレビュー
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs font-semibold text-muted">{item.industry}</p>
        <h3 className="mt-2 text-lg font-bold leading-relaxed">{item.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{item.summary}</p>
        <p className="mt-auto flex items-center gap-2 pt-6 text-sm font-bold group-hover:text-brand">
          事例を詳しく見る
          <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
        </p>
      </div>
    </Link>
  );
}
