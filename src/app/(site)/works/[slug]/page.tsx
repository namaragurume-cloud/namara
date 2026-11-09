import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getCase, getVisibleCases } from "@/data/cases";
import { getCreatorById } from "@/data/creators";
import { pageMetadata } from "@/lib/metadata";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { CTAButton } from "@/components/ui/CTAButton";
import { InstagramEmbed } from "@/components/ui/InstagramEmbed";
import { PageHero } from "@/components/ui/PageHero";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getVisibleCases().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const item = getCase(slug);
  if (!item) return {};
  return pageMetadata({
    title: `${item.title}｜発信者の実績`,
    description: item.summary,
    path: `/works/${item.slug}`,
    noindex: !item.published,
  });
}

export default async function WorkDetailPage({ params }: Props) {
  const { slug } = await params;
  const item = getCase(slug);
  if (!item) notFound();
  const creator = getCreatorById(item.creatorId);

  const sections = [
    { title: "PR対象の商品・サービス", body: [item.product ?? item.industry, item.summary] },
    { title: "PRの目的", body: [item.challenge] },
    { title: "実施した内容", body: item.actions ?? [] },
    { title: "起用したインフルエンサー", body: [creator ? (creator.name ?? `@${creator.account}`) : undefined] },
    { title: "投稿媒体", body: [item.media] },
    { title: "実績", body: [item.result] },
    { title: "実施後の考察", body: [item.insight] },
  ]
    .map((s) => ({ ...s, body: s.body.filter((b): b is string => Boolean(b)) }))
    .filter((s) => s.body.length > 0)
    .map((s, i) => ({ ...s, no: String(i + 1).padStart(2, "0") }));

  return (
    <>
      <PageHero
        en={`CASE ${item.no}`}
        title={item.title}
        lead={
          creator ? (
            <span className="flex flex-wrap items-center gap-3">
              {item.industry}
              <a
                href={creator.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-white py-1 pr-4 pl-1 text-sm font-bold text-ink ring-1 ring-line hover:text-brand"
              >
                {creator.image && (
                  <Image src={creator.image} alt="" width={28} height={28} className="size-7 rounded-full object-cover" />
                )}
                {creator.name ?? creator.account} の投稿
              </a>
            </span>
          ) : (
            item.industry
          )
        }
        breadcrumb={[
          { label: "発信者の実績", href: "/works" },
          { label: item.title, href: `/works/${item.slug}` },
        ]}
      />

      {!item.published && (
        <div className="bg-brand py-3 text-center text-sm font-bold text-white">
          非公開プレビュー：この事例は公開されていません{item.todo.length > 0 && `（確認事項：${item.todo.join("、")}）`}
        </div>
      )}

      <section className="section">
        <div className="container-x max-w-5xl!">
          <ScrollReveal className="bg-gradient-brand rounded-[28px] p-8 text-white shadow-[0_30px_60px_-30px_rgba(217,83,58,0.6)] md:p-14">
            <p className="text-sm text-white/80">{item.metric.label}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              {item.metric.value ? (
                <span className="num text-6xl font-extrabold md:text-8xl">{item.metric.value}</span>
              ) : (
                <>
                  <span className="num text-3xl font-bold text-white/80 md:text-5xl">{item.metric.before}</span>
                  <ArrowRight size={36} aria-label="から" className="text-white/80" />
                  <span className="num text-5xl font-extrabold md:text-7xl">{item.metric.after}</span>
                </>
              )}
              {item.metric.highlight && (
                <span className="rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold">{item.metric.highlight}</span>
              )}
            </div>
            {item.metric.period && (
              <p className="mt-6 border-t border-white/30 pt-4 text-xs text-white/80">
                測定単位・比較期間：{item.metric.period}
              </p>
            )}
            {item.metric.label.includes("再生") && (
              <p className="mt-2 text-xs text-white/80">
                ※再生回数はPR投稿が視聴された回数で、来店数や売上を示すものではありません。
              </p>
            )}
          </ScrollReveal>

          <div className="mt-16 space-y-12">
            {sections.map((s) => (
              <ScrollReveal key={s.no} className="grid gap-4 border-t border-line pt-8 md:grid-cols-[240px_1fr] md:gap-10">
                <h2 className="flex items-baseline gap-3 font-bold">
                  <span className="num text-sm text-brand">{s.no}</span>
                  {s.title}
                </h2>
                <div className="space-y-3 text-[15px] leading-[2] text-ink/80">
                  {s.body.map((b) => (
                    <p key={b}>{b}</p>
                  ))}
                </div>
              </ScrollReveal>
            ))}
          </div>

          {item.instagram && item.instagram.length > 0 && (
            <ScrollReveal className="mt-16 border-t border-line pt-8">
              <h2 className="font-bold">実際の投稿</h2>
              <div className={item.instagram.length > 1 ? "mt-8 grid gap-8 md:grid-cols-2" : "mt-8"}>
                {item.instagram.map((url) => (
                  <InstagramEmbed key={url} url={url} />
                ))}
              </div>
            </ScrollReveal>
          )}

          <p className="mt-12 text-xs leading-relaxed text-muted">
            ※成果はPR以外の要因（季節、他の販促施策など）を含む場合があります。
          </p>

          <div className="mt-16 flex flex-col items-center gap-4 rounded-[28px] bg-mist p-8 text-center md:p-14">
            <p className="text-xl font-bold md:text-2xl">同じような課題をお持ちの方へ</p>
            <p className="text-sm text-muted">目的やご予算をお伺いし、最適なPRをご提案します。</p>
            <CTAButton href="/contact" size="lg" trackLocation="work_detail" className="mt-4">
              無料でPRプランを相談する
            </CTAButton>
          </div>
        </div>
      </section>
      <FinalCTA />
    </>
  );
}
