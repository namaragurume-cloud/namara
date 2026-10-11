"use client";

import { m, useScroll, useSpring } from "motion/react";
import { useRef } from "react";
import type { HistoryYear } from "@/data/history";
import { ScrollReveal } from "@/components/animation/ScrollReveal";

/** スクロールに合わせて線が伸びる活動年表 */
export function Timeline({ items }: { items: HistoryYear[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const scaleY = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  return (
    <ol ref={ref} className="relative">
      <span aria-hidden="true" className="absolute top-2 bottom-2 left-[7px] w-px bg-line md:left-[167px]" />
      <m.span
        aria-hidden="true"
        style={{ scaleY }}
        className="absolute top-2 bottom-2 left-[7px] w-px origin-top bg-brand md:left-[167px]"
      />
      {items.map((year) => (
        <ScrollReveal as="li" key={year.year} className="relative grid gap-4 pb-14 pl-10 last:pb-0 md:grid-cols-[136px_1fr] md:gap-16 md:pl-0">
          <span
            aria-hidden="true"
            className="absolute top-2 left-0 size-[15px] rounded-full border-[3px] border-brand bg-white md:left-[160px]"
          />
          <p className="num text-3xl leading-none font-extrabold md:text-right md:text-4xl">{year.year}</p>
          <ul className="space-y-4 md:pl-4">
            {year.events.map((e) => (
              <li key={e.text} className="flex gap-4 rounded-2xl bg-white p-5 md:p-6">
                <span className="num w-10 shrink-0 font-bold text-brand">{e.month}</span>
                <span className="font-bold leading-relaxed">{e.text}</span>
              </li>
            ))}
          </ul>
        </ScrollReveal>
      ))}
    </ol>
  );
}
