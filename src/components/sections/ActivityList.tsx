import Image from "next/image";
import { MapPin } from "lucide-react";
import type { Activity } from "@/data/activities";
import { ScrollReveal } from "@/components/animation/ScrollReveal";
import { cn } from "@/lib/utils";

/** /about の活動紹介（写真と詳細文） */
export function ActivityList({ items }: { items: Activity[] }) {
  return (
    <div className="space-y-20 md:space-y-28">
      {items.map((a, i) => {
        const [main, ...rest] = a.photos;
        return (
          <ScrollReveal
            as="article"
            key={a.id}
            className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
          >
            <div className={cn("grid gap-3", i % 2 === 1 && "lg:order-2", rest.length > 0 && "grid-cols-4")}>
              <div className={cn("relative aspect-[4/3] overflow-hidden rounded-[24px] bg-mist", rest.length > 0 && "col-span-4")}>
                <Image
                  src={main.src}
                  alt={main.alt}
                  fill
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  style={main.position ? { objectPosition: main.position } : undefined}
                  className="object-cover"
                />
              </div>
              {rest.map((ph) => (
                <div key={ph.src} className="relative aspect-square overflow-hidden rounded-2xl bg-mist">
                  <Image src={ph.src} alt={ph.alt} fill sizes="(min-width: 1024px) 11vw, 25vw" className="object-cover" />
                </div>
              ))}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                <span className="rounded-full bg-brand px-3 py-1 text-white">{a.category}</span>
                <span className="flex items-center gap-1 text-muted">
                  <MapPin size={13} aria-hidden="true" />
                  {a.place}
                </span>
                {a.date && <span className="text-muted">{a.date}</span>}
              </div>
              <h3 className="heading-md mt-4 text-[1.375rem] md:text-[1.75rem]">{a.title}</h3>
              <div className="mt-5 space-y-4 text-[15px] leading-[2.1] text-ink/80">
                {a.body.map((b) => (
                  <p key={b}>{b}</p>
                ))}
              </div>
            </div>
          </ScrollReveal>
        );
      })}
    </div>
  );
}
