import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin, UserRound } from "lucide-react";
import { formatFollowers, type CreatorView } from "@/data/creators";
import { showFollowerCounts } from "@/data/site";
import { InstagramIcon } from "./InstagramIcon";

export function CreatorCard({ creator }: { creator: CreatorView }) {
  const label = creator.name ?? creator.account;
  const contactHref = `/contact?creator=${encodeURIComponent(`${label}（@${creator.account}）`)}`;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[24px] border border-line bg-white transition-all duration-500 ease-out-expo hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.3)]">
      <div className="relative aspect-square overflow-hidden bg-mist">
        {creator.image ? (
          <Image
            src={creator.image}
            alt={`${label}のプロフィール画像`}
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 80vw"
            className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-ink/20" role="img" aria-label="プロフィール画像（未設定）">
            <UserRound size={72} strokeWidth={1.2} />
          </div>
        )}
        {!creator.published && (
          <span className="absolute top-3 left-3 rounded-full bg-brand px-3 py-1 text-[10px] font-bold text-white">
            非公開プレビュー
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <p className="text-lg font-bold">{label}</p>
        <a
          href={creator.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1.5 self-start text-sm text-muted transition-colors hover:text-brand"
        >
          <InstagramIcon size={15} />@{creator.account}
          <ArrowUpRight size={14} aria-hidden="true" />
          <span className="sr-only">（{creator.platform}を新しいタブで開きます）</span>
        </a>

        {showFollowerCounts && creator.followers !== undefined && (
          <p className="mt-5 flex items-baseline gap-1.5">
            <span className="num text-3xl font-extrabold">{formatFollowers(creator.followers)}</span>
            <span className="text-xs text-muted">フォロワー</span>
          </p>
        )}

        {creator.areas.length > 0 && (
          <p className="mt-4 flex items-center gap-1.5 text-sm text-muted">
            <MapPin size={15} aria-hidden="true" />
            <span className="sr-only">活動エリア：</span>
            {creator.areas.join("・")}
          </p>
        )}
        {creator.genres.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="得意ジャンル">
            {creator.genres.map((g) => (
              <li key={g} className="rounded-full bg-mist px-3 py-1 text-xs font-semibold">
                {g}
              </li>
            ))}
          </ul>
        )}

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
        {showFollowerCounts && creator.followers !== undefined && (
          <p className="mt-2 text-[11px] text-muted">
            {creator.followersLive
              ? "※フォロワー数はInstagramから自動で更新しています"
              : creator.followersAsOf
                ? `※フォロワー数は${creator.followersAsOf}時点`
                : "※フォロワー数は掲載時点のものです"}
          </p>
        )}
      </div>
    </article>
  );
}
