import Image from "next/image";
import { ArrowRight, Megaphone, Play, Store } from "lucide-react";
import { getCase } from "@/data/cases";
import { getCreatorById, getVisibleCreators } from "@/data/creators";

/**
 * トップ最上部の図解。
 * 「企業・飲食店 → MIRATSUMU が発信者をキャスティング → インフルエンサーがSNSで発信」の流れを示します。
 * 投稿例はPR実績（cases.ts）のデータを使用しています。
 */

function Avatars({ size = 36 }: { size?: number }) {
  const list = getVisibleCreators().filter((c) => c.image).slice(0, 5);
  return (
    <span className="flex -space-x-2.5">
      {list.map((c) => (
        <Image
          key={c.id}
          src={c.image!}
          alt=""
          width={size}
          height={size}
          className="rounded-full object-cover ring-2 ring-white"
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  );
}

function Step({ no, title, children }: { no: string; title: string; children: React.ReactNode }) {
  return (
    <div className="glass relative rounded-2xl p-4">
      <p className="num text-[10px] font-semibold tracking-[0.2em] text-brand">STEP {no}</p>
      <p className="mt-1 text-[15px] font-bold">{title}</p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

/** PC：右側の図解 */
export function HeroVisual() {
  const example = getCase("wagashi");
  const creator = getCreatorById(example?.creatorId);
  return (
    <div className="relative hidden w-[500px] shrink-0 items-center gap-4 xl:flex">
      {/* 3ステップ */}
      <div className="relative flex w-[260px] flex-col gap-3">
        <span aria-hidden="true" className="absolute top-8 bottom-8 left-[27px] w-px bg-gradient-to-b from-brand/50 via-accent/50 to-brand/50" />
        <Step no="01" title="企業・飲食店">
          <p className="flex items-center gap-2 text-xs text-muted">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mist text-ink">
              <Store size={16} aria-hidden="true" />
            </span>
            「新メニューを広めたい」
          </p>
        </Step>
        <Step no="02" title="MIRATSUMUがキャスティング">
          <div className="flex items-center gap-2.5">
            <Image src="/images/brand/miratsumu-symbol.png" alt="" width={400} height={361} className="h-8 w-auto" />
            <p className="text-xs leading-relaxed text-muted">目的・予算に合う発信者を選定し、企画から進行まで担当</p>
          </div>
        </Step>
        <Step no="03" title="グルメインフルエンサーが発信">
          <div className="flex items-center gap-2.5">
            <Avatars size={30} />
            <p className="text-xs text-muted">SNSで魅力を届ける</p>
          </div>
        </Step>
      </div>

      <ArrowRight size={20} aria-hidden="true" className="shrink-0 text-brand" />

      {/* 投稿例（スマホ） */}
      {example?.thumbnail && (
        <figure className="relative w-[196px] shrink-0">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[30px] border-[6px] border-ink bg-ink shadow-[0_40px_70px_-30px_rgba(120,60,30,0.55)]">
            <Image src={example.thumbnail} alt={`${example.title}の投稿画像`} fill sizes="220px" priority className="object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10 text-white">
              <p className="flex items-center gap-1.5 text-[11px] font-bold">
                <Play size={12} aria-hidden="true" fill="currentColor" />
                {example.metric.value}再生
              </p>
              {creator && <p className="mt-1 truncate text-[10px] text-white/80">{creator.name ?? creator.account}</p>}
            </div>
          </div>
          <figcaption className="glass absolute -top-4 -right-4 rounded-xl px-3 py-2 text-[11px] font-bold">
            <span className="block text-[10px] font-semibold text-brand">PR投稿の例</span>
            Instagramリール
          </figcaption>
        </figure>
      )}
    </div>
  );
}

/** スマホ・タブレット：横並びのミニ図解 */
export function HeroFlowCompact() {
  const items = [
    { label: "企業・飲食店", icon: <Store size={18} aria-hidden="true" /> },
    {
      label: "MIRATSUMU",
      icon: <Image src="/images/brand/miratsumu-symbol.png" alt="" width={400} height={361} className="h-5 w-auto" />,
    },
    { label: "インフルエンサー", icon: <Avatars size={22} /> },
    { label: "SNSで発信", icon: <Megaphone size={18} aria-hidden="true" /> },
  ];
  return (
    <ol className="glass mt-6 grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center gap-1 rounded-2xl px-2 py-3 xl:hidden" aria-label="サービスの流れ">
      {items.map((it, i) => (
        <li key={it.label} className="contents">
          <span className="flex flex-col items-center gap-1.5 text-center">
            <span className="grid h-8 place-items-center text-ink">{it.icon}</span>
            <span className="text-[10px] leading-tight font-bold whitespace-nowrap">{it.label}</span>
          </span>
          {i < items.length - 1 && <ArrowRight size={14} aria-hidden="true" className="text-brand" />}
        </li>
      ))}
    </ol>
  );
}
