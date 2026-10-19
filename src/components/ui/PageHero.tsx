import type { ReactNode } from "react";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { SectionLabel } from "./SectionHeading";

type Props = {
  en: string;
  title: ReactNode;
  lead?: ReactNode;
  breadcrumb: Crumb[];
  children?: ReactNode;
};

/** 下層ページ共通のページ見出し */
export function PageHero({ en, title, lead, breadcrumb, children }: Props) {
  return (
    <section className="relative isolate overflow-hidden bg-cream pt-[calc(var(--header-h)+40px)] pb-16 md:pt-[calc(var(--header-h)+72px)] md:pb-24">
      <div aria-hidden="true" className="bg-glow absolute inset-0 -z-10" />
      <div aria-hidden="true" className="bg-grid absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="num pointer-events-none absolute -right-4 bottom-[-0.18em] text-[22vw] leading-none font-extrabold tracking-tighter text-ink/[0.035] select-none md:text-[15vw]"
      >
        {en}
      </div>
      <div className="container-x relative">
        <Breadcrumb items={breadcrumb} />
        <div className="anim-fade-up mt-10 md:mt-14">
          <SectionLabel>{en}</SectionLabel>
          <h1 className="heading-xl mt-6 max-w-5xl text-[clamp(2rem,1.3rem+3.2vw,4rem)]">{title}</h1>
          {lead && <div className="lead mt-8 max-w-3xl">{lead}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}
