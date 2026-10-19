import type { Service } from "@/data/services";

export function ServiceCard({ service }: { service: Service }) {
  const Icon = service.icon;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[24px] bg-white p-7 transition-all duration-500 ease-out-expo hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-30px_rgba(0,0,0,0.3)] md:p-9">
      <div className="flex items-start justify-between">
        <span className="grid size-14 place-items-center rounded-2xl bg-mist text-ink transition-colors duration-500 group-hover:bg-gradient-brand group-hover:text-white">
          <Icon size={26} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <span className="num text-sm font-bold text-ink/25">{service.no}</span>
      </div>
      <p className="num mt-8 text-[10.5px] font-semibold tracking-[0.25em] text-brand">{service.en}</p>
      <h3 className="mt-2 text-lg font-bold leading-relaxed md:text-xl">{service.title}</h3>
      <p className="mt-3 text-sm leading-[1.95] text-muted">{service.summary}</p>
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-brand transition-transform duration-500 ease-out-expo group-hover:scale-x-100"
      />
    </article>
  );
}
