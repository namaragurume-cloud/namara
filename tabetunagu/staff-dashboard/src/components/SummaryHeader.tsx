type Props = {
  listed: number;
  sold: number;
  remaining: number;
  waitingCount: number;
  bumpKey: number;
};

/** 本日の状況（超特大の数字。離れた場所からでも読める） */
export function SummaryHeader({ listed, sold, remaining, waitingCount, bumpKey }: Props) {
  const tiles = [
    { label: "出品中", value: listed, tone: "bg-stone-100 text-stone-900" },
    { label: "売上済", value: sold, tone: "bg-brand text-white", sub: waitingCount > 0 ? `うち受取待ち ${waitingCount}` : "すべて受取完了" },
    { label: "残り", value: remaining, tone: remaining === 0 ? "bg-stone-100 text-stone-400" : "bg-stone-100 text-stone-900", sub: remaining === 0 ? "完売" : undefined },
  ];
  return (
    <section aria-label="本日の状況" className="grid grid-cols-3 gap-2 sm:gap-3">
      {tiles.map((t) => (
        <div key={t.label} className={`flex flex-col items-center justify-center rounded-3xl px-1 py-3 sm:py-4 ${t.tone}`}>
          <p className="text-[17px] font-black tracking-wider sm:text-xl">{t.label}</p>
          <p key={t.label === "売上済" ? bumpKey : undefined} className="num animate-bump text-[64px] font-extrabold leading-none sm:text-[96px]">
            {t.value}
          </p>
          <p className="mt-1 h-5 text-[13px] font-bold opacity-80 sm:text-sm">{t.sub ?? ""}</p>
        </div>
      ))}
    </section>
  );
}
