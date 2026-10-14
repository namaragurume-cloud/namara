import Image from "next/image";
import { MapPin } from "lucide-react";
import type { Activity } from "@/data/activities";

/** 活動紹介のカード（トップページのカルーセル用） */
export function ActivityCard({ activity }: { activity: Activity }) {
  const photo = activity.photos[0];
  return (
    <article className="group relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[24px] bg-ink text-white">
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 80vw"
        className="object-cover transition-transform duration-1000 ease-out-expo group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      <div className="relative p-6 md:p-7">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-brand px-3 py-1">{activity.category}</span>
          <span className="flex items-center gap-1 text-white/80">
            <MapPin size={12} aria-hidden="true" />
            {activity.place}
          </span>
          {activity.date && <span className="text-white/60">{activity.date}</span>}
        </div>
        <h3 className="mt-3 text-lg leading-relaxed font-bold md:text-xl">{activity.title}</h3>
        <p className="mt-2 text-[13px] leading-[1.9] text-white/75">{activity.summary}</p>
      </div>
    </article>
  );
}
