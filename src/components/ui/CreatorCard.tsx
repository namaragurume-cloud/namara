import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin, UserRound } from "lucide-react";
import { formatFollowers, type Creator } from "@/data/creators";

export function CreatorCard({ creator }: { creator: Creator }) {
  const contactHref = `/contact?creator=${encodeURIComponent(`@${creator.account}`)}`;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-line bg-white transition-all duration-500 ease-out-expo hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.3)]">
      <div className="relative aspect-[4/5] overflow-hidden bg-mist">
        {creator.image ? (
          <Image
            src={creator.image}
            alt={`${creator.name ?? creator.account}のプロフィール写真`}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 80vw"
            className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-ink/20" role="img" aria-label="プロフィール写真（未設定）">
            <UserRound size={72} strokeWidth={1.2} />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-16 text-white">
          <p className="num text-[10px] font-semibold tracking-[0.2em] text-white/70">{creator.platform.toUpperCase()}</p>
          <p className="mt-1 flex items-baseline gap-1">
            <span className="num text-3xl font-extrabold">{formatFollowers(creator.followers)}</span>
            <span className="text-xs">フォロワー</span>
          </p>
        </div>
        {!creator.published && (
          <span className="absolute top-3 left-3 rounded-full bg-brand px-3 py-1 text-[10px] font-bold text-white">
            非公開プレビュー
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <a
          href={creator.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 self-start text-lg font-bold transition-colors hover:text-brand"
        >
          @{creator.account}
          <ArrowUpRight size={16} aria-hidden="true" />
          <span className="sr-only">（{creator.platform}を新しいタブで開きます）</span>
        </a>
        {creator.name && <p className="text-sm text-muted">{creator.name}</p>}

        <p className="mt-4 flex items-center gap-1.5 text-sm text-muted">
          <MapPin size={15} aria-hidden="true" />
          <span className="sr-only">活動エリア：</span>
          {creator.areas.join("・")}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="得意ジャンル">
          {creator.genres.map((g) => (
            <li key={g} className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">
              {g}
            </li>
          ))}
        </ul>

        {creator.examples && creator.examples.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-bold text-muted">投稿事例</p>
            <ul className="mt-2 space-y-1.5">
              {creator.examples.map((ex) => (
                <li key={ex.url}>
                  <a
                    href={ex.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm underline decoration-line underline-offset-4 hover:text-brand"
                  >
                    {ex.title}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href={contactHref}
          className="group/btn mt-auto flex min-h-12 items-center justify-between gap-2 border-t border-line pt-5 text-sm font-bold transition-colors hover:text-brand"
        >
          この発信者を含めて相談する
          <ArrowRight size={16} aria-hidden="true" className="transition-transform group-hover/btn:translate-x-1" />
        </Link>
        {creator.followersAsOf && (
          <p className="mt-2 text-[11px] text-muted">※フォロワー数は{creator.followersAsOf}時点</p>
        )}
      </div>
    </article>
  );
}
