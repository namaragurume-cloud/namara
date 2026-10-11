"use client";

import { Plus } from "lucide-react";
import { useId, useState } from "react";
import type { FaqItem } from "@/data/faq";
import { cn } from "@/lib/utils";

export function FAQAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item, i) => {
        const isOpen = open === i;
        const btnId = `${baseId}-q-${i}`;
        const panelId = `${baseId}-a-${i}`;
        return (
          <div key={item.q}>
            <h3>
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="group flex w-full items-start gap-4 py-6 text-left md:gap-6 md:py-7"
              >
                <span className="num mt-0.5 text-lg font-extrabold text-brand">Q</span>
                <span className="flex-1 text-[15px] leading-[1.8] font-bold transition-colors group-hover:text-brand md:text-base">
                  {item.q}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full border border-line transition-all duration-300",
                    isOpen && "rotate-45 border-ink bg-ink text-white",
                  )}
                >
                  <Plus size={16} />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              className={cn(
                "grid transition-[grid-template-rows] duration-500 ease-out-expo",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden" inert={!isOpen}>
                <div className="flex gap-4 pb-7 md:gap-6">
                  <span className="num text-lg font-extrabold text-ink/30">A</span>
                  <p className="flex-1 pr-12 text-[15px] leading-[2] text-muted">{item.a}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
